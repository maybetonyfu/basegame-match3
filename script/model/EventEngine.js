let listenerMap = new Map()

export default class EventEmitter {
  constructor() {
  }
  static addListener(label, callback) {
    listenerMap.has(label) || listenerMap.set(label, [])
    listenerMap.get(label).push(callback)
  }

  static removeListener(label, callback) {
      let listeners = listenerMap.get(label),
          index;

      if (listeners && listeners.length) {
          index = listeners.reduce((i, listener, index) => {
              return (typeof listener == "function" && listener === callback) ?
                  i = index :
                  i
          }, -1)

          if (index > -1) {
              listeners.splice(index, 1)
              listenerMap.set(label, listeners)
              return true
          }
      }
      return false;
  }
  static emit(label, ...args) {
      let listeners = listenerMap.get(label)

      if (listeners && listeners.length) {
          listeners.forEach((listener) => {
              listener(...args)
          });
          return true
      }
      return false
  }
}

