"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    }, entry.name);

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if ((typeof exports == 'object' || typeof exports == 'function') && exports !== global) {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(["1"], [], function($__System) {

(function() {
  var loader = $__System;
  
  if (typeof window != 'undefined' && typeof document != 'undefined' && window.location)
    var windowOrigin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');

  loader.set('@@cjs-helpers', loader.newModule({
    getPathVars: function(moduleId) {
      // remove any plugin syntax
      var pluginIndex = moduleId.lastIndexOf('!');
      var filename;
      if (pluginIndex != -1)
        filename = moduleId.substr(0, pluginIndex);
      else
        filename = moduleId;

      var dirname = filename.split('/');
      dirname.pop();
      dirname = dirname.join('/');

      if (filename.substr(0, 8) == 'file:///') {
        filename = filename.substr(7);
        dirname = dirname.substr(7);

        // on windows remove leading '/'
        if (isWindows) {
          filename = filename.substr(1);
          dirname = dirname.substr(1);
        }
      }
      else if (windowOrigin && filename.substr(0, windowOrigin.length) === windowOrigin) {
        filename = filename.substr(windowOrigin.length);
        dirname = dirname.substr(windowOrigin.length);
      }

      return {
        filename: filename,
        dirname: dirname
      };
    }
  }));
})();

$__System.register("2", [], function (_export) {
    "use strict";

    var checkMatch;
    return {
        setters: [],
        execute: function () {
            checkMatch = function checkMatch(list) {
                if (!list.length || list.length < 2) {
                    console.error("Cannot cascade a non-array object or too short");
                    return;
                }
                var match = [];
                var combo = false;
                for (var index = 0; index < list.length - 2; index = index + 1) {
                    if (list[index] === list[index + 1] && list[index] === list[index + 2]) {
                        if (combo) {
                            match.push(index + 2);
                        } else {
                            combo = true;
                            match.push(index);
                            match.push(index + 1);
                            match.push(index + 2);
                        }
                    } else {
                        combo = false;
                    }
                }
                return match;
            };

            _export("checkMatch", checkMatch);
        }
    };
});
$__System.register("3", ["4"], function (_export) {
    var _toConsumableArray, cascade;

    return {
        setters: [function (_) {
            _toConsumableArray = _["default"];
        }],
        execute: function () {
            "use strict";

            cascade = function cascade(list) {
                var length = list.length;
                if (!length || length < 2) {
                    console.error("Cannot cascade a non-array object or too short");
                    return;
                }
                var after = list.filter(function (value) {
                    return value >= 0;
                });
                return [].concat(_toConsumableArray(Array(length - after.length).fill(-1)), _toConsumableArray(after));
            };

            _export("cascade", cascade);
        }
    };
});
$__System.register("5", [], function (_export) {
    "use strict";

    var generateMotionVector;
    return {
        setters: [],
        execute: function () {
            generateMotionVector = function generateMotionVector(list) {
                var distance = 0;
                return list.reverse().map(function (value) {
                    if (value == -1) {
                        distance++;
                        return 0;
                    } else {
                        return distance;
                    }
                }).reverse();
            };

            _export("generateMotionVector", generateMotionVector);
        }
    };
});
$__System.register("6", [], function (_export) {
    "use strict";

    var transposeMatrix;
    return {
        setters: [],
        execute: function () {
            transposeMatrix = function transposeMatrix(matrix) {
                var T = [];
                matrix.forEach(function (row, rowIndex) {
                    row.forEach(function (col, colIndex) {
                        if (!T[colIndex]) T[colIndex] = [];
                        T[colIndex].push(col);
                    });
                });
                return T;
            };

            _export("transposeMatrix", transposeMatrix);
        }
    };
});
$__System.register("7", ["2", "3", "5", "6", "8", "9", "a"], function (_export) {
    var checkMatch, cascade, generateMotionVector, transposeMatrix, _createClass, _classCallCheck, _getIterator, Board;

    return {
        setters: [function (_3) {
            checkMatch = _3.checkMatch;
        }, function (_4) {
            cascade = _4.cascade;
        }, function (_5) {
            generateMotionVector = _5.generateMotionVector;
        }, function (_6) {
            transposeMatrix = _6.transposeMatrix;
        }, function (_) {
            _createClass = _["default"];
        }, function (_2) {
            _classCallCheck = _2["default"];
        }, function (_a) {
            _getIterator = _a["default"];
        }],
        execute: function () {
            "use strict";

            Board = (function () {
                function Board(rows, cols, species) {
                    _classCallCheck(this, Board);

                    this.rows = rows;
                    this.cols = cols;
                    this.species = species;
                    this.match = [];
                    this.elements = Array(rows).fill([]).map(function () {
                        return Array(cols).fill(0).map(function () {
                            return Math.floor(Math.random() * species);
                        });
                    });
                }

                _createClass(Board, [{
                    key: "getCell",
                    value: function getCell(point) {
                        var x = point[0];
                        var y = point[1];
                        return this.elements[x][y];
                    }
                }, {
                    key: "setCell",
                    value: function setCell(point, value) {
                        var x = point[0];
                        var y = point[1];
                        this.elements[x][y] = value;
                    }
                }, {
                    key: "getRow",
                    value: function getRow(i) {
                        return this.elements[i];
                    }
                }, {
                    key: "setRow",
                    value: function setRow(i, list) {
                        this.elements[i] = list;
                    }
                }, {
                    key: "getCol",
                    value: function getCol(i) {
                        return this.elements.map(function (r) {
                            return r[i];
                        });
                    }
                }, {
                    key: "setCol",
                    value: function setCol(index, list) {
                        this.elements.forEach(function (row, rowIndex) {
                            row[index] = list[rowIndex];
                        });
                    }
                }, {
                    key: "findMatch",
                    value: function findMatch() {
                        var row = this.rows;
                        var col = this.cols;
                        var matchList = [];
                        while (row--) {
                            var rowElements = this.getRow(row);
                            var rowResult = checkMatch(rowElements);
                            var _iteratorNormalCompletion = true;
                            var _didIteratorError = false;
                            var _iteratorError = undefined;

                            try {
                                for (var _iterator = _getIterator(rowResult), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                    var match = _step.value;

                                    matchList.push([row, match]);
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion && _iterator["return"]) {
                                        _iterator["return"]();
                                    }
                                } finally {
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        }
                        while (col--) {
                            var colElements = this.getCol(col);
                            var colResult = checkMatch(colElements);
                            var _iteratorNormalCompletion2 = true;
                            var _didIteratorError2 = false;
                            var _iteratorError2 = undefined;

                            try {
                                for (var _iterator2 = _getIterator(colResult), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                    var match = _step2.value;

                                    matchList.push([match, col]);
                                }
                            } catch (err) {
                                _didIteratorError2 = true;
                                _iteratorError2 = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
                                        _iterator2["return"]();
                                    }
                                } finally {
                                    if (_didIteratorError2) {
                                        throw _iteratorError2;
                                    }
                                }
                            }
                        }
                        this.match = matchList;
                    }
                }, {
                    key: "removeMatch",
                    value: function removeMatch() {
                        var _this = this;

                        this.match.forEach(function (match) {
                            _this.setCell(match, -1);
                        });
                        this.match = [];
                    }
                }, {
                    key: "cascadeBoard",
                    value: function cascadeBoard() {
                        var col = this.cols;
                        while (col--) {
                            var colElements = this.getCol(col);
                            var sortedCol = cascade(colElements);
                            this.setCol(col, sortedCol);
                        }
                    }
                }, {
                    key: "refillBoard",
                    value: function refillBoard() {
                        var _this2 = this;

                        var species = this.species;
                        this.elements.forEach(function (row, index) {
                            _this2.elements[index] = row.map(function (col) {
                                return col === -1 ? Math.floor(Math.random() * species) : col;
                            });
                        });
                    }
                }, {
                    key: "swap",
                    value: function swap(pointA, pointB) {
                        var temp = this.getCell(pointA);
                        this.setCell(pointA, this.getCell(pointB));
                        this.setCell(pointB, temp);
                    }
                }, {
                    key: "transposeBoard",
                    value: function transposeBoard() {
                        return transposeMatrix(this.elements);
                    }
                }, {
                    key: "generateMotionMatrix",
                    value: function generateMotionMatrix() {
                        var T = transposeMatrix(this.elements).map(function (col) {
                            return generateMotionVector(col);
                        });
                        return transposeMatrix(T);
                    }
                }]);

                return Board;
            })();

            _export("default", Board);
        }
    };
});
$__System.register("b", ["c"], function (_export) {
    /*
    Handle the event attatched to .board DOM element
    Add clicked item to a size 2 queue and swap if move is legal
    */

    "use strict";

    var EventEngine, select, adjasent;
    return {
        setters: [function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            select = function select(e, queue) {
                if (e.target !== e.currentTarget) {
                    var tappedItem = e.target;
                    if (tappedItem.classList.contains("tile")) {
                        queue.add(tappedItem);

                        if (queue.isFull()) {
                            queue.elements[0].style.animation = '';
                            queue.elements[1].style.animation = '';

                            if (queue.isLegal(adjasent)) {
                                EventEngine.emit("play.swap");
                                //queue.reset()
                            } else {
                                    console.log("Not Legal!");
                                    queue.reset();
                                }
                        } else {
                            tappedItem.style.animation = 'breath 3s ease infinite';
                        }
                        // console.log(queue)
                    } else {
                            //better way to handle if click is on board but not tile
                            throw new Error("Invalid click on the board");
                        }
                }
                e.stopPropagation();
            };

            adjasent = function adjasent(els) {
                var elA = els[0];
                var elB = els[1];
                var rowA = elA.dataset.row;
                var colA = elA.dataset.col;
                var rowB = elB.dataset.row;
                var colB = elB.dataset.col;
                return Math.abs(rowA - rowB) + Math.abs(colA - colB) == 1;
            };

            _export("default", select);
        }
    };
});
$__System.register("d", ["e", "c"], function (_export) {
    "use strict";

    var updateBoard, EventEngine;
    return {
        setters: [function (_e) {
            updateBoard = _e["default"];
        }, function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            _export("default", function (elements, board) {

                var elA = elements[0];
                var elB = elements[1];

                var animationEnd = false;

                var pointA = [elA.dataset.row, elA.dataset.col];
                var pointB = [elB.dataset.row, elB.dataset.col];

                var duration = 300;

                if (elA.dataset.row === elB.dataset.row) {
                    if (elA.dataset.col < elB.dataset.col) {
                        console.log("horizontal");
                        elA.style.animation = "left-to-right " + duration + "ms ease";
                        elB.style.animation = "right-to-left " + duration + "ms ease";
                    } else {
                        console.log("horizontal reverse");
                        elA.style.animation = "right-to-left " + duration + "ms ease";
                        elB.style.animation = "left-to-right " + duration + "ms ease";
                    }
                }

                if (elA.dataset.col === elB.dataset.col) {
                    if (elA.dataset.row < elB.dataset.row) {
                        console.log("vertical");
                        elA.style.animation = "top-to-bottom " + duration + "ms ease";
                        elB.style.animation = "bottom-to-top " + duration + "ms ease";
                    } else {
                        console.log("vertical reverse");
                        elA.style.animation = "bottom-to-top " + duration + "ms ease";
                        elB.style.animation = "top-to-bottom " + duration + "ms ease";
                    }
                }

                elA.addEventListener("animationend", onAnimationEnd, false);
                elB.addEventListener("animationend", onAnimationEnd, false);

                // elB.addEventListener("animationend", onAnimationEnd, false);

                function onAnimationEnd() {
                    if (!animationEnd) {
                        animationEnd = true;
                        return;
                    }

                    elA.style.animation = "";
                    elB.style.animation = "";

                    var elCloneA = elA.cloneNode(true);
                    elA.parentNode.replaceChild(elCloneA, elA);

                    var elCloneB = elB.cloneNode(true);
                    elB.parentNode.replaceChild(elCloneB, elB);

                    console.log("Update swap");

                    board.swap(pointA, pointB);
                    updateBoard(board);
                    EventEngine.emit("play.findMatch");
                }
            });
        }
    };
});
$__System.register("f", [], function (_export) {
    "use strict";

    return {
        setters: [],
        execute: function () {
            _export("default", function (boardModel) {
                var parent = document.createElement("DIV");
                parent.classList.add("board");
                document.body.appendChild(parent);
                for (var row in boardModel.elements) {
                    var div = document.createElement('DIV');
                    div.classList.add("row");
                    parent.appendChild(div);

                    for (var col in boardModel.elements[row]) {
                        var tile = document.createElement('div');
                        tile.classList.add("tile");
                        tile.dataset.row = row;
                        tile.dataset.col = col;
                        tile.classList.add("row-" + row);
                        tile.classList.add("col-" + col);
                        div.appendChild(tile);
                    }
                }
            });
        }
    };
});
$__System.register('10', ['c'], function (_export) {
    'use strict';

    var EventEngine;
    return {
        setters: [function (_c) {
            EventEngine = _c['default'];
        }],
        execute: function () {
            _export('default', function (boardModel) {

                // calculate board size specs
                var windowWidth = document.documentElement.clientWidth;
                var windowHeight = document.documentElement.clientHeight;
                var windowShorterSide = Math.min(windowWidth, windowHeight);
                var boardLonggerSide = Math.max(boardModel.rows, boardModel.cols);
                var tileOuter = windowShorterSide / boardLonggerSide;
                var boardHeight = tileOuter * boardModel.rows;
                var boardWidth = tileOuter * boardModel.cols;
                var tileGutter = 5;
                var tileInner = tileOuter - 2 * tileGutter;
                var padding = tileInner / 2;

                // write to document header css
                var style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = '\n        .board {\n            height: ' + boardHeight + 'px;\n            width: ' + boardWidth + 'px;\n        }\n        .row {\n            height: ' + tileOuter + 'px;\n            width: ' + boardWidth + 'px;\n        }\n        .tile {\n            width: ' + tileInner + 'px;\n            height: ' + tileInner + 'px;\n            line-height: ' + tileInner + 'px;\n            margin: ' + tileGutter + 'px;\n            font-size: ' + padding + 'px;\n        }\n        @keyframes left-to-right {\n            0% {\n                transform: translateX(0);\n            }\n            100% {\n                transform: translateX(' + tileOuter + 'px);\n            }\n        }\n        @keyframes right-to-left {\n            0% {\n                transform: translateX(0);\n            }\n            100% {\n                transform: translateX(-' + tileOuter + 'px);\n            }\n        }\n        @keyframes top-to-bottom {\n            0% {\n                transform: translateY(0);\n            }\n            100% {\n                transform: translateY(' + tileOuter + 'px);\n            }\n        }\n        @keyframes bottom-to-top {\n            0% {\n                transform: translateY(0);\n            }\n            100% {\n                transform: translateY(-' + tileOuter + 'px);\n            }\n        }\n        ';

                for (var row = 1; row < boardModel.rows; row++) {
                    var dropDistance = row * tileOuter;
                    style.innerHTML += '\n        @keyframes drop-' + row + ' {\n            0% {\n                ransform: translateY(0px);\n            }\n            100% {\n                transform: translateY(' + dropDistance + 'px);\n            }\n        }\n        ';
                }
                document.getElementsByTagName('head')[0].appendChild(style);

                EventEngine.emit('initiate.board');
            });
        }
    };
});
$__System.register("11", ["12", "e", "c"], function (_export) {
    var _Set, updateBoard, EventEngine;

    return {
        setters: [function (_) {
            _Set = _["default"];
        }, function (_e) {
            updateBoard = _e["default"];
        }, function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            "use strict";

            _export("default", function (board) {

                var matches = board.match;
                var matchedElements = new _Set();
                matches.forEach(function (match) {

                    var row = match[0];
                    var col = match[1];

                    var tile = document.getElementsByClassName("row-" + row + " col-" + col)[0];

                    tile.style.animation = "mark 300ms ease";
                    matchedElements.add(tile);

                    tile.addEventListener("animationend", onAnimationEnd, false);
                });

                function onAnimationEnd(e) {
                    var currentElement = e.target;
                    currentElement.style.animation = "";

                    matchedElements["delete"](currentElement);

                    var elClone = currentElement.cloneNode(true);
                    currentElement.parentNode.replaceChild(elClone, currentElement);

                    if (matchedElements.size === 0) {

                        board.removeMatch();
                        updateBoard(board);
                        EventEngine.emit("play.dropTiles");
                    }
                }
            });
        }
    };
});
$__System.register("13", ["4", "12", "e", "c"], function (_export) {
    var _toConsumableArray, _Set, updateBoard, EventEngine;

    return {
        setters: [function (_) {
            _toConsumableArray = _["default"];
        }, function (_2) {
            _Set = _2["default"];
        }, function (_e) {
            updateBoard = _e["default"];
        }, function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            "use strict";

            _export("default", function (board) {

                var tiles = [].concat(_toConsumableArray(document.getElementsByClassName('tile')));
                var dropTiles = new _Set();
                var MotionMatrix = board.generateMotionMatrix();

                tiles.forEach(function (tile) {
                    var row = tile.dataset.row;
                    var col = tile.dataset.col;
                    var dropDistance = MotionMatrix[row][col];

                    if (dropDistance !== 0) {
                        tile.style.animation = "drop-" + dropDistance + " 550ms ease";
                        tile.addEventListener("animationend", onAnimationEnd, false);
                        dropTiles.add(tile);
                    }
                });
                if (dropTiles.size === 0) {
                    EventEngine.emit("play.refillBoard");
                }

                function onAnimationEnd(e) {
                    console.log("element drop finish");
                    var currentElement = e.target;
                    currentElement.style.animation = "";

                    dropTiles["delete"](currentElement);

                    var elClone = currentElement.cloneNode(true);
                    currentElement.parentNode.replaceChild(elClone, currentElement);

                    if (dropTiles.size === 0) {
                        console.log("Drop Finished");
                        board.cascadeBoard();
                        updateBoard(board);
                        EventEngine.emit("play.refillBoard");
                    }
                }
            });
        }
    };
});
$__System.registerDynamic("14", ["15"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var defined = $__require('15');
  module.exports = function(it) {
    return Object(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("16", ["17"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ITERATOR = $__require('17')('iterator'),
      SAFE_CLOSING = false;
  try {
    var riter = [7][ITERATOR]();
    riter['return'] = function() {
      SAFE_CLOSING = true;
    };
    Array.from(riter, function() {
      throw 2;
    });
  } catch (e) {}
  module.exports = function(exec, skipClosing) {
    if (!skipClosing && !SAFE_CLOSING)
      return false;
    var safe = false;
    try {
      var arr = [7],
          iter = arr[ITERATOR]();
      iter.next = function() {
        safe = true;
      };
      arr[ITERATOR] = function() {
        return iter;
      };
      exec(arr);
    } catch (e) {}
    return safe;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("18", ["19", "1a", "14", "1b", "1c", "1d", "1e", "16"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ctx = $__require('19'),
      $export = $__require('1a'),
      toObject = $__require('14'),
      call = $__require('1b'),
      isArrayIter = $__require('1c'),
      toLength = $__require('1d'),
      getIterFn = $__require('1e');
  $export($export.S + $export.F * !$__require('16')(function(iter) {
    Array.from(iter);
  }), 'Array', {from: function from(arrayLike) {
      var O = toObject(arrayLike),
          C = typeof this == 'function' ? this : Array,
          $$ = arguments,
          $$len = $$.length,
          mapfn = $$len > 1 ? $$[1] : undefined,
          mapping = mapfn !== undefined,
          index = 0,
          iterFn = getIterFn(O),
          length,
          result,
          step,
          iterator;
      if (mapping)
        mapfn = ctx(mapfn, $$len > 2 ? $$[2] : undefined, 2);
      if (iterFn != undefined && !(C == Array && isArrayIter(iterFn))) {
        for (iterator = iterFn.call(O), result = new C; !(step = iterator.next()).done; index++) {
          result[index] = mapping ? call(iterator, mapfn, [step.value, index], true) : step.value;
        }
      } else {
        length = toLength(O.length);
        for (result = new C(length); length > index; index++) {
          result[index] = mapping ? mapfn(O[index], index) : O[index];
        }
      }
      result.length = index;
      return result;
    }});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1f", ["20", "18", "21"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('20');
  $__require('18');
  module.exports = $__require('21').Array.from;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("22", ["1f"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('1f'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4", ["22"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var _Array$from = $__require('22')["default"];
  exports["default"] = function(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0,
          arr2 = Array(arr.length); i < arr.length; i++)
        arr2[i] = arr[i];
      return arr2;
    } else {
      return _Array$from(arr);
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("23", ["24", "25"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var strong = $__require('24');
  $__require('25')('Set', function(get) {
    return function Set() {
      return get(this, arguments.length > 0 ? arguments[0] : undefined);
    };
  }, {add: function add(value) {
      return strong.def(this, value = value === 0 ? 0 : value, value);
    }}, strong);
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("26", ["1a", "27"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $export = $__require('1a');
  $export($export.P, 'Set', {toJSON: $__require('27')('Set')});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("28", ["29", "20", "2a", "23", "26", "21"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('29');
  $__require('20');
  $__require('2a');
  $__require('23');
  $__require('26');
  module.exports = $__require('21').Set;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12", ["28"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('28'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2b", ["2c", "1e", "21"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = $__require('2c'),
      get = $__require('1e');
  module.exports = $__require('21').getIterator = function(it) {
    var iterFn = get(it);
    if (typeof iterFn != 'function')
      throw TypeError(it + ' is not iterable!');
    return anObject(iterFn.call(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2d", ["2a", "20", "2b"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('2a');
  $__require('20');
  module.exports = $__require('2b');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a", ["2d"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('2d'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register("e", ["a"], function (_export) {
    var _getIterator;

    return {
        setters: [function (_a) {
            _getIterator = _a["default"];
        }],
        execute: function () {
            "use strict";

            _export("default", function (boardModel) {
                var symbolList = ["🍏", "🍌", "🍐", "🍒", "🍆", "🍉", "🍇", "🍓"];
                var tiles = document.getElementsByClassName('tile');
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = _getIterator(tiles), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var tile = _step.value;

                        var row = tile.dataset.row;
                        var col = tile.dataset.col;

                        if (boardModel.elements[row][col] == -1) {
                            tile.style.opacity = 0;
                        } else {
                            var tileValue = boardModel.elements[row][col];
                            var symbol = symbolList[tileValue];
                            tile.innerHTML = symbol;
                            tile.style.opacity = 1;
                        }
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator["return"]) {
                            _iterator["return"]();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
            });
        }
    };
});
$__System.register("2e", ["4", "12", "e", "c"], function (_export) {
    var _toConsumableArray, _Set, updateBoard, EventEngine;

    return {
        setters: [function (_) {
            _toConsumableArray = _["default"];
        }, function (_2) {
            _Set = _2["default"];
        }, function (_e) {
            updateBoard = _e["default"];
        }, function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            "use strict";

            _export("default", function (board) {
                var tiles = [].concat(_toConsumableArray(document.getElementsByClassName('tile')));
                var regeneratedTiles = new _Set();

                tiles.forEach(function (tile) {
                    var row = tile.dataset.row;
                    var col = tile.dataset.col;
                    if (board.elements[row][col] === -1) {
                        tile.style.animation = "grow ease 600ms";
                        regeneratedTiles.add(tile);
                        tile.addEventListener("animationend", onAnimationEnd, false);
                    }
                });
                board.refillBoard();
                updateBoard(board);

                function onAnimationEnd(e) {
                    console.log("element refill finish");
                    var currentElement = e.target;
                    currentElement.style.animation = "";

                    regeneratedTiles["delete"](currentElement);

                    var elClone = currentElement.cloneNode(true);
                    currentElement.parentNode.replaceChild(elClone, currentElement);

                    if (regeneratedTiles.size === 0) {
                        console.log("Refill Finished");
                        EventEngine.emit("play.findMatch");
                    }
                }
            });
        }
    };
});
$__System.registerDynamic("29", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2f", ["30", "15"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = $__require('30'),
      defined = $__require('15');
  module.exports = function(TO_STRING) {
    return function(that, pos) {
      var s = String(defined(that)),
          i = toInteger(pos),
          l = s.length,
          a,
          b;
      if (i < 0 || i >= l)
        return TO_STRING ? '' : undefined;
      a = s.charCodeAt(i);
      return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("20", ["2f", "31"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $at = $__require('2f')(true);
  $__require('31')(String, 'String', function(iterated) {
    this._t = String(iterated);
    this._i = 0;
  }, function() {
    var O = this._t,
        index = this._i,
        point;
    if (index >= O.length)
      return {
        value: undefined,
        done: true
      };
    point = $at(O, index);
    this._i += point.length;
    return {
      value: point,
      done: false
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("32", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function() {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("33", ["34"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = $__require('34');
  module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("35", ["33", "15"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var IObject = $__require('33'),
      defined = $__require('15');
  module.exports = function(it) {
    return IObject(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("36", ["32", "37", "38", "35", "31"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var addToUnscopables = $__require('32'),
      step = $__require('37'),
      Iterators = $__require('38'),
      toIObject = $__require('35');
  module.exports = $__require('31')(Array, 'Array', function(iterated, kind) {
    this._t = toIObject(iterated);
    this._i = 0;
    this._k = kind;
  }, function() {
    var O = this._t,
        kind = this._k,
        index = this._i++;
    if (!O || index >= O.length) {
      this._t = undefined;
      return step(1);
    }
    if (kind == 'keys')
      return step(0, index);
    if (kind == 'values')
      return step(0, O[index]);
    return step(0, [index, O[index]]);
  }, 'values');
  Iterators.Arguments = Iterators.Array;
  addToUnscopables('keys');
  addToUnscopables('values');
  addToUnscopables('entries');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2a", ["36", "38"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('36');
  var Iterators = $__require('38');
  Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (it == undefined)
      throw TypeError("Can't call method on  " + it);
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("39", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3a", ["3b", "3c", "3d", "3e", "17"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('3b'),
      descriptor = $__require('3c'),
      setToStringTag = $__require('3d'),
      IteratorPrototype = {};
  $__require('3e')(IteratorPrototype, $__require('17')('iterator'), function() {
    return this;
  });
  module.exports = function(Constructor, NAME, next) {
    Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
    setToStringTag(Constructor, NAME + ' Iterator');
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("31", ["39", "1a", "3f", "3e", "40", "38", "3a", "3d", "3b", "17"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var LIBRARY = $__require('39'),
      $export = $__require('1a'),
      redefine = $__require('3f'),
      hide = $__require('3e'),
      has = $__require('40'),
      Iterators = $__require('38'),
      $iterCreate = $__require('3a'),
      setToStringTag = $__require('3d'),
      getProto = $__require('3b').getProto,
      ITERATOR = $__require('17')('iterator'),
      BUGGY = !([].keys && 'next' in [].keys()),
      FF_ITERATOR = '@@iterator',
      KEYS = 'keys',
      VALUES = 'values';
  var returnThis = function() {
    return this;
  };
  module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
    $iterCreate(Constructor, NAME, next);
    var getMethod = function(kind) {
      if (!BUGGY && kind in proto)
        return proto[kind];
      switch (kind) {
        case KEYS:
          return function keys() {
            return new Constructor(this, kind);
          };
        case VALUES:
          return function values() {
            return new Constructor(this, kind);
          };
      }
      return function entries() {
        return new Constructor(this, kind);
      };
    };
    var TAG = NAME + ' Iterator',
        DEF_VALUES = DEFAULT == VALUES,
        VALUES_BUG = false,
        proto = Base.prototype,
        $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT],
        $default = $native || getMethod(DEFAULT),
        methods,
        key;
    if ($native) {
      var IteratorPrototype = getProto($default.call(new Base));
      setToStringTag(IteratorPrototype, TAG, true);
      if (!LIBRARY && has(proto, FF_ITERATOR))
        hide(IteratorPrototype, ITERATOR, returnThis);
      if (DEF_VALUES && $native.name !== VALUES) {
        VALUES_BUG = true;
        $default = function values() {
          return $native.call(this);
        };
      }
    }
    if ((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) {
      hide(proto, ITERATOR, $default);
    }
    Iterators[NAME] = $default;
    Iterators[TAG] = returnThis;
    if (DEFAULT) {
      methods = {
        values: DEF_VALUES ? $default : getMethod(VALUES),
        keys: IS_SET ? $default : getMethod(KEYS),
        entries: !DEF_VALUES ? $default : getMethod('entries')
      };
      if (FORCED)
        for (key in methods) {
          if (!(key in proto))
            redefine(proto, key, methods[key]);
        }
      else
        $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
    }
    return methods;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("37", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(done, value) {
    return {
      value: value,
      done: !!done
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("41", ["21", "3b", "42", "17"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var core = $__require('21'),
      $ = $__require('3b'),
      DESCRIPTORS = $__require('42'),
      SPECIES = $__require('17')('species');
  module.exports = function(KEY) {
    var C = core[KEY];
    if (DESCRIPTORS && C && !C[SPECIES])
      $.setDesc(C, SPECIES, {
        configurable: true,
        get: function() {
          return this;
        }
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("24", ["3b", "3e", "43", "19", "44", "15", "45", "31", "37", "46", "40", "47", "41", "42"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('3b'),
      hide = $__require('3e'),
      redefineAll = $__require('43'),
      ctx = $__require('19'),
      strictNew = $__require('44'),
      defined = $__require('15'),
      forOf = $__require('45'),
      $iterDefine = $__require('31'),
      step = $__require('37'),
      ID = $__require('46')('id'),
      $has = $__require('40'),
      isObject = $__require('47'),
      setSpecies = $__require('41'),
      DESCRIPTORS = $__require('42'),
      isExtensible = Object.isExtensible || isObject,
      SIZE = DESCRIPTORS ? '_s' : 'size',
      id = 0;
  var fastKey = function(it, create) {
    if (!isObject(it))
      return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
    if (!$has(it, ID)) {
      if (!isExtensible(it))
        return 'F';
      if (!create)
        return 'E';
      hide(it, ID, ++id);
    }
    return 'O' + it[ID];
  };
  var getEntry = function(that, key) {
    var index = fastKey(key),
        entry;
    if (index !== 'F')
      return that._i[index];
    for (entry = that._f; entry; entry = entry.n) {
      if (entry.k == key)
        return entry;
    }
  };
  module.exports = {
    getConstructor: function(wrapper, NAME, IS_MAP, ADDER) {
      var C = wrapper(function(that, iterable) {
        strictNew(that, C, NAME);
        that._i = $.create(null);
        that._f = undefined;
        that._l = undefined;
        that[SIZE] = 0;
        if (iterable != undefined)
          forOf(iterable, IS_MAP, that[ADDER], that);
      });
      redefineAll(C.prototype, {
        clear: function clear() {
          for (var that = this,
              data = that._i,
              entry = that._f; entry; entry = entry.n) {
            entry.r = true;
            if (entry.p)
              entry.p = entry.p.n = undefined;
            delete data[entry.i];
          }
          that._f = that._l = undefined;
          that[SIZE] = 0;
        },
        'delete': function(key) {
          var that = this,
              entry = getEntry(that, key);
          if (entry) {
            var next = entry.n,
                prev = entry.p;
            delete that._i[entry.i];
            entry.r = true;
            if (prev)
              prev.n = next;
            if (next)
              next.p = prev;
            if (that._f == entry)
              that._f = next;
            if (that._l == entry)
              that._l = prev;
            that[SIZE]--;
          }
          return !!entry;
        },
        forEach: function forEach(callbackfn) {
          var f = ctx(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3),
              entry;
          while (entry = entry ? entry.n : this._f) {
            f(entry.v, entry.k, this);
            while (entry && entry.r)
              entry = entry.p;
          }
        },
        has: function has(key) {
          return !!getEntry(this, key);
        }
      });
      if (DESCRIPTORS)
        $.setDesc(C.prototype, 'size', {get: function() {
            return defined(this[SIZE]);
          }});
      return C;
    },
    def: function(that, key, value) {
      var entry = getEntry(that, key),
          prev,
          index;
      if (entry) {
        entry.v = value;
      } else {
        that._l = entry = {
          i: index = fastKey(key, true),
          k: key,
          v: value,
          p: prev = that._l,
          n: undefined,
          r: false
        };
        if (!that._f)
          that._f = entry;
        if (prev)
          prev.n = entry;
        that[SIZE]++;
        if (index !== 'F')
          that._i[index] = entry;
      }
      return that;
    },
    getEntry: getEntry,
    setStrong: function(C, NAME, IS_MAP) {
      $iterDefine(C, NAME, function(iterated, kind) {
        this._t = iterated;
        this._k = kind;
        this._l = undefined;
      }, function() {
        var that = this,
            kind = that._k,
            entry = that._l;
        while (entry && entry.r)
          entry = entry.p;
        if (!that._t || !(that._l = entry = entry ? entry.n : that._t._f)) {
          that._t = undefined;
          return step(1);
        }
        if (kind == 'keys')
          return step(0, entry.k);
        if (kind == 'values')
          return step(0, entry.v);
        return step(0, [entry.k, entry.v]);
      }, IS_MAP ? 'entries' : 'values', !IS_MAP, true);
      setSpecies(NAME);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3c", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3e", ["3b", "3c", "42"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('3b'),
      createDesc = $__require('3c');
  module.exports = $__require('42') ? function(object, key, value) {
    return $.setDesc(object, key, createDesc(1, value));
  } : function(object, key, value) {
    object[key] = value;
    return object;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3f", ["3e"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = $__require('3e');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("43", ["3f"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var redefine = $__require('3f');
  module.exports = function(target, src) {
    for (var key in src)
      redefine(target, key, src[key]);
    return target;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("44", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it, Constructor, name) {
    if (!(it instanceof Constructor))
      throw TypeError(name + ": use the 'new' operator!");
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("40", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var hasOwnProperty = {}.hasOwnProperty;
  module.exports = function(it, key) {
    return hasOwnProperty.call(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3d", ["3b", "40", "17"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var def = $__require('3b').setDesc,
      has = $__require('40'),
      TAG = $__require('17')('toStringTag');
  module.exports = function(it, tag, stat) {
    if (it && !has(it = stat ? it : it.prototype, TAG))
      def(it, TAG, {
        configurable: true,
        value: tag
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("48", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("42", ["48"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = !$__require('48')(function() {
    return Object.defineProperty({}, 'a', {get: function() {
        return 7;
      }}).a != 7;
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("25", ["3b", "49", "1a", "48", "3e", "43", "45", "44", "47", "3d", "42"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('3b'),
      global = $__require('49'),
      $export = $__require('1a'),
      fails = $__require('48'),
      hide = $__require('3e'),
      redefineAll = $__require('43'),
      forOf = $__require('45'),
      strictNew = $__require('44'),
      isObject = $__require('47'),
      setToStringTag = $__require('3d'),
      DESCRIPTORS = $__require('42');
  module.exports = function(NAME, wrapper, methods, common, IS_MAP, IS_WEAK) {
    var Base = global[NAME],
        C = Base,
        ADDER = IS_MAP ? 'set' : 'add',
        proto = C && C.prototype,
        O = {};
    if (!DESCRIPTORS || typeof C != 'function' || !(IS_WEAK || proto.forEach && !fails(function() {
      new C().entries().next();
    }))) {
      C = common.getConstructor(wrapper, NAME, IS_MAP, ADDER);
      redefineAll(C.prototype, methods);
    } else {
      C = wrapper(function(target, iterable) {
        strictNew(target, C, NAME);
        target._c = new Base;
        if (iterable != undefined)
          forOf(iterable, IS_MAP, target[ADDER], target);
      });
      $.each.call('add,clear,delete,forEach,get,has,set,keys,values,entries'.split(','), function(KEY) {
        var IS_ADDER = KEY == 'add' || KEY == 'set';
        if (KEY in proto && !(IS_WEAK && KEY == 'clear'))
          hide(C.prototype, KEY, function(a, b) {
            if (!IS_ADDER && IS_WEAK && !isObject(a))
              return KEY == 'get' ? undefined : false;
            var result = this._c[KEY](a === 0 ? 0 : a, b);
            return IS_ADDER ? this : result;
          });
      });
      if ('size' in proto)
        $.setDesc(C.prototype, 'size', {get: function() {
            return this._c.size;
          }});
    }
    setToStringTag(C, NAME);
    O[NAME] = C;
    $export($export.G + $export.W + $export.F, O);
    if (!IS_WEAK)
      common.setStrong(C, NAME, IS_MAP);
    return C;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4a", ["24", "25"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var strong = $__require('24');
  $__require('25')('Map', function(get) {
    return function Map() {
      return get(this, arguments.length > 0 ? arguments[0] : undefined);
    };
  }, {
    get: function get(key) {
      var entry = strong.getEntry(this, key);
      return entry && entry.v;
    },
    set: function set(key, value) {
      return strong.def(this, key === 0 ? 0 : key, value);
    }
  }, strong, true);
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1a", ["49", "21", "19"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = $__require('49'),
      core = $__require('21'),
      ctx = $__require('19'),
      PROTOTYPE = 'prototype';
  var $export = function(type, name, source) {
    var IS_FORCED = type & $export.F,
        IS_GLOBAL = type & $export.G,
        IS_STATIC = type & $export.S,
        IS_PROTO = type & $export.P,
        IS_BIND = type & $export.B,
        IS_WRAP = type & $export.W,
        exports = IS_GLOBAL ? core : core[name] || (core[name] = {}),
        target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE],
        key,
        own,
        out;
    if (IS_GLOBAL)
      source = name;
    for (key in source) {
      own = !IS_FORCED && target && key in target;
      if (own && key in exports)
        continue;
      out = own ? target[key] : source[key];
      exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key] : IS_BIND && own ? ctx(out, global) : IS_WRAP && target[key] == out ? (function(C) {
        var F = function(param) {
          return this instanceof C ? new C(param) : C(param);
        };
        F[PROTOTYPE] = C[PROTOTYPE];
        return F;
      })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
      if (IS_PROTO)
        (exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
    }
  };
  $export.F = 1;
  $export.G = 2;
  $export.S = 4;
  $export.P = 8;
  $export.B = 16;
  $export.W = 32;
  module.exports = $export;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4b", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (typeof it != 'function')
      throw TypeError(it + ' is not a function!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("19", ["4b"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var aFunction = $__require('4b');
  module.exports = function(fn, that, length) {
    aFunction(fn);
    if (that === undefined)
      return fn;
    switch (length) {
      case 1:
        return function(a) {
          return fn.call(that, a);
        };
      case 2:
        return function(a, b) {
          return fn.call(that, a, b);
        };
      case 3:
        return function(a, b, c) {
          return fn.call(that, a, b, c);
        };
    }
    return function() {
      return fn.apply(that, arguments);
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1b", ["2c"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = $__require('2c');
  module.exports = function(iterator, fn, value, entries) {
    try {
      return entries ? fn(anObject(value)[0], value[1]) : fn(value);
    } catch (e) {
      var ret = iterator['return'];
      if (ret !== undefined)
        anObject(ret.call(iterator));
      throw e;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1c", ["38", "17"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Iterators = $__require('38'),
      ITERATOR = $__require('17')('iterator'),
      ArrayProto = Array.prototype;
  module.exports = function(it) {
    return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("47", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2c", ["47"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = $__require('47');
  module.exports = function(it) {
    if (!isObject(it))
      throw TypeError(it + ' is not an object!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("30", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ceil = Math.ceil,
      floor = Math.floor;
  module.exports = function(it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1d", ["30"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = $__require('30'),
      min = Math.min;
  module.exports = function(it) {
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("38", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1e", ["4c", "17", "38", "21"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var classof = $__require('4c'),
      ITERATOR = $__require('17')('iterator'),
      Iterators = $__require('38');
  module.exports = $__require('21').getIteratorMethod = function(it) {
    if (it != undefined)
      return it[ITERATOR] || it['@@iterator'] || Iterators[classof(it)];
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("45", ["19", "1b", "1c", "2c", "1d", "1e"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ctx = $__require('19'),
      call = $__require('1b'),
      isArrayIter = $__require('1c'),
      anObject = $__require('2c'),
      toLength = $__require('1d'),
      getIterFn = $__require('1e');
  module.exports = function(iterable, entries, fn, that) {
    var iterFn = getIterFn(iterable),
        f = ctx(fn, that, entries ? 2 : 1),
        index = 0,
        length,
        step,
        iterator;
    if (typeof iterFn != 'function')
      throw TypeError(iterable + ' is not iterable!');
    if (isArrayIter(iterFn))
      for (length = toLength(iterable.length); length > index; index++) {
        entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
      }
    else
      for (iterator = iterFn.call(iterable); !(step = iterator.next()).done; ) {
        call(iterator, f, step.value, entries);
      }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("34", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString;
  module.exports = function(it) {
    return toString.call(it).slice(8, -1);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4d", ["49"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = $__require('49'),
      SHARED = '__core-js_shared__',
      store = global[SHARED] || (global[SHARED] = {});
  module.exports = function(key) {
    return store[key] || (store[key] = {});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("46", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var id = 0,
      px = Math.random();
  module.exports = function(key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("49", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if (typeof __g == 'number')
    __g = global;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("17", ["4d", "46", "49"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var store = $__require('4d')('wks'),
      uid = $__require('46'),
      Symbol = $__require('49').Symbol;
  module.exports = function(name) {
    return store[name] || (store[name] = Symbol && Symbol[name] || (Symbol || uid)('Symbol.' + name));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4c", ["34", "17"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = $__require('34'),
      TAG = $__require('17')('toStringTag'),
      ARG = cof(function() {
        return arguments;
      }()) == 'Arguments';
  module.exports = function(it) {
    var O,
        T,
        B;
    return it === undefined ? 'Undefined' : it === null ? 'Null' : typeof(T = (O = Object(it))[TAG]) == 'string' ? T : ARG ? cof(O) : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("27", ["45", "4c"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var forOf = $__require('45'),
      classof = $__require('4c');
  module.exports = function(NAME) {
    return function toJSON() {
      if (classof(this) != NAME)
        throw TypeError(NAME + "#toJSON isn't generic");
      var arr = [];
      forOf(this, false, arr.push, arr);
      return arr;
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4e", ["1a", "27"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $export = $__require('1a');
  $export($export.P, 'Map', {toJSON: $__require('27')('Map')});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("21", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var core = module.exports = {version: '1.2.6'};
  if (typeof __e == 'number')
    __e = core;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4f", ["29", "20", "2a", "4a", "4e", "21"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('29');
  $__require('20');
  $__require('2a');
  $__require('4a');
  $__require('4e');
  module.exports = $__require('21').Map;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("50", ["4f"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('4f'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register("c", ["8", "9", "50"], function (_export) {
    var _createClass, _classCallCheck, _Map, listenerMap, EventEmitter;

    return {
        setters: [function (_) {
            _createClass = _["default"];
        }, function (_2) {
            _classCallCheck = _2["default"];
        }, function (_3) {
            _Map = _3["default"];
        }],
        execute: function () {
            "use strict";

            listenerMap = new _Map();

            EventEmitter = (function () {
                function EventEmitter() {
                    _classCallCheck(this, EventEmitter);
                }

                _createClass(EventEmitter, null, [{
                    key: "addListener",
                    value: function addListener(label, callback) {
                        listenerMap.has(label) || listenerMap.set(label, []);
                        listenerMap.get(label).push(callback);
                    }
                }, {
                    key: "removeListener",
                    value: function removeListener(label, callback) {
                        var listeners = listenerMap.get(label),
                            index = undefined;

                        if (listeners && listeners.length) {
                            index = listeners.reduce(function (i, listener, index) {
                                return typeof listener == "function" && listener === callback ? i = index : i;
                            }, -1);

                            if (index > -1) {
                                listeners.splice(index, 1);
                                listenerMap.set(label, listeners);
                                return true;
                            }
                        }
                        return false;
                    }
                }, {
                    key: "emit",
                    value: function emit(label) {
                        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                            args[_key - 1] = arguments[_key];
                        }

                        var listeners = listenerMap.get(label);

                        if (listeners && listeners.length) {
                            listeners.forEach(function (listener) {
                                listener.apply(undefined, args);
                            });
                            return true;
                        }
                        return false;
                    }
                }]);

                return EventEmitter;
            })();

            _export("default", EventEmitter);
        }
    };
});
$__System.registerDynamic("3b", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $Object = Object;
  module.exports = {
    create: $Object.create,
    getProto: $Object.getPrototypeOf,
    isEnum: {}.propertyIsEnumerable,
    getDesc: $Object.getOwnPropertyDescriptor,
    setDesc: $Object.defineProperty,
    setDescs: $Object.defineProperties,
    getKeys: $Object.keys,
    getNames: $Object.getOwnPropertyNames,
    getSymbols: $Object.getOwnPropertySymbols,
    each: [].forEach
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("51", ["3b"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('3b');
  module.exports = function defineProperty(it, key, desc) {
    return $.setDesc(it, key, desc);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("52", ["51"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('51'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8", ["52"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var _Object$defineProperty = $__require('52')["default"];
  exports["default"] = (function() {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor)
          descriptor.writable = true;
        _Object$defineProperty(target, descriptor.key, descriptor);
      }
    }
    return function(Constructor, protoProps, staticProps) {
      if (protoProps)
        defineProperties(Constructor.prototype, protoProps);
      if (staticProps)
        defineProperties(Constructor, staticProps);
      return Constructor;
    };
  })();
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9", [], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  exports["default"] = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.register("53", ["8", "9"], function (_export) {
    var _createClass, _classCallCheck, SelectQueue;

    return {
        setters: [function (_) {
            _createClass = _["default"];
        }, function (_2) {
            _classCallCheck = _2["default"];
        }],
        execute: function () {
            "use strict";

            SelectQueue = (function () {
                function SelectQueue() {
                    _classCallCheck(this, SelectQueue);

                    var elements = [];
                    this.elements = elements;
                }

                _createClass(SelectQueue, [{
                    key: "add",
                    value: function add(item) {
                        if (this.isFull()) this.elements.pop();
                        if (this.elements[0] !== item) {
                            this.elements.push(item);
                        }
                    }
                }, {
                    key: "reset",
                    value: function reset() {
                        this.elements = [];
                    }
                }, {
                    key: "isFull",
                    value: function isFull() {
                        return this.elements.length === 2;
                    }
                }, {
                    key: "isLegal",
                    value: function isLegal(fn) {
                        if (!this.isFull()) return false;
                        return fn(this.elements);
                    }
                }]);

                return SelectQueue;
            })();

            _export("default", SelectQueue);
        }
    };
});
$__System.register("1", ["7", "10", "11", "13", "53", "b", "d", "f", "e", "2e", "c"], function (_export) {
    "use strict";

    var Board, initiateStyle, markMatch, dropTiles, SelectQueue, select, swap, initiateBoard, updateBoard, refillBoard, EventEngine, selectQueue, board, parentContainer;
    return {
        setters: [function (_) {
            Board = _["default"];
        }, function (_2) {
            initiateStyle = _2["default"];
        }, function (_3) {
            markMatch = _3["default"];
        }, function (_4) {
            dropTiles = _4["default"];
        }, function (_5) {
            SelectQueue = _5["default"];
        }, function (_b) {
            select = _b["default"];
        }, function (_d) {
            swap = _d["default"];
        }, function (_f) {
            initiateBoard = _f["default"];
        }, function (_e) {
            updateBoard = _e["default"];
        }, function (_e2) {
            refillBoard = _e2["default"];
        }, function (_c) {
            EventEngine = _c["default"];
        }],
        execute: function () {
            selectQueue = new SelectQueue();
            board = new Board(6, 6, 4);

            EventEngine.addListener("initiate.board", function () {
                console.info("Initiating Board");
                initiateBoard(board);
                EventEngine.emit("initiate.findMatch");
            });

            EventEngine.addListener("initiate.findMatch", function () {
                console.info("Finding Match");
                board.findMatch();
                if (board.match.length !== 0) {
                    console.info("Match Found Proceeding Next Process");
                    EventEngine.emit("initiate.removeMatch");
                } else {
                    console.info("No Match Found Game Start");
                    EventEngine.emit("initiate.updateBoard");
                }
            });

            EventEngine.addListener("initiate.removeMatch", function () {
                console.info("Removing Match");
                board.removeMatch();
                EventEngine.emit("initiate.cascadeBoard");
            });

            EventEngine.addListener("initiate.cascadeBoard", function () {
                console.info("Cascading");
                board.cascadeBoard();
                EventEngine.emit("initiate.refillBoard");
            });

            EventEngine.addListener("initiate.refillBoard", function () {
                console.info("Refilling");
                board.refillBoard();
                EventEngine.emit("initiate.findMatch");
            });

            EventEngine.addListener("initiate.updateBoard", function () {
                console.info("Rendering");
                updateBoard(board);
            });

            EventEngine.addListener("play.swap", function () {
                console.info("Swapping Selected Tiles");
                var elements = selectQueue.elements;
                swap(elements, board);
                selectQueue.reset();
            });

            EventEngine.addListener("play.findMatch", function () {
                console.info("Finding Match");
                board.findMatch();
                if (board.match.length !== 0) {
                    console.info("Match Found Proceeding Next Process");
                    markMatch(board);
                    //EventEngine.emit("initiate.removeMatch")
                } else {
                        console.info("No Match Found Game Continue");
                        //EventEngine.emit("initiate.updateBoard")
                    }
            });

            EventEngine.addListener("play.dropTiles", function () {
                console.info("Now drop floating tiles");
                dropTiles(board);
            });

            EventEngine.addListener("play.refillBoard", function () {
                console.info("Now refill some new tiles");
                refillBoard(board);
            });

            initiateStyle(board);

            parentContainer = document.getElementsByClassName('board')[0];

            parentContainer.addEventListener('click', function (e) {
                select(e, selectQueue);
            }, false);
        }
    };
});
})
(function(factory) {
  factory();
});
//# sourceMappingURL=app.js.map