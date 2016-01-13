
let createBoardTemplate = function  (boardModel) {
    let parent = document.createElement("DIV")
    parent.classList.add("board")
    document.body.appendChild(parent)
    for (let row in boardModel.elements) {
        let div = document.createElement('DIV')
        div.classList.add("row")
        parent.appendChild(div)

        for (let col in boardModel.elements[row]) {
            let tile = document.createElement('div')
            tile.classList.add("tile")
            tile.dataset.row = row
            tile.dataset.col = col
            div.appendChild(tile)
        }
    }
}

let updateBoardTemplate = function  (boardModel) {
    let symbolList = ["🍏", "🍌", "🍐", "🍒", "🍆", "🍉", "🍇", "🍓"]
    let tiles = document.getElementsByClassName('tile')
    for (let tile of tiles) {
        let row = tile.dataset.row
        let col = tile.dataset.col
        for (let dropRow = 1; dropRow < boardModel.rows; dropRow ++) {
            tile.classList.remove(`drop-${dropRow}`)
            tile.style.opacity = 0
        }
        if (boardModel.elements[row][col] == -1) {
            tile.classList.remove("entry")
            tile.style.opacity = 0
        }
        else {
            let tileValue = boardModel.elements[row][col]
            let symbol = symbolList[tileValue]
            tile.innerHTML = symbol
            tile.style.opacity = 1
            tile.classList.add("entry")
        }
    }
}

let initiateBoardSpecs = (boardModel) => {
    let windowWidth = document.documentElement.clientWidth
    let windowHeight = document.documentElement.clientHeight
    let windowShorterSide = Math.min(windowWidth, windowHeight)
    let boardLonggerSide = Math.max(boardModel.rows, boardModel.cols)
    let tileOuter = windowShorterSide / boardLonggerSide
    let boardHeight = tileOuter * boardModel.rows
    let boardWidth = tileOuter * boardModel.cols
    let tileGutter = 1
    let tileInner = tileOuter - 2 * tileGutter
    let padding = tileInner / 2
    let style = document.createElement('style')
    style.type = 'text/css'
    style.innerHTML = `
    .board {
        height: ${boardHeight}px;
        width: ${boardWidth}px;
    }
    .row {
        height: ${tileOuter}px;
        width: ${boardWidth}px;
    }
    .tile {
        width: ${tileInner}px;
        height: ${tileInner}px;
        line-height: ${tileInner}px;
        margin: ${tileGutter}px;
        font-size: ${padding}px;
    }
    `
    for (let row = 1; row < boardModel.rows; row ++) {
        let dropDistance = row * tileOuter
        style.innerHTML += `
        .drop-${row} {
            z-index: 1;
            transition: transform 0.1s;
            transform: translateY(${dropDistance}px);
        }
        `
    }
    document.getElementsByTagName('head')[0].appendChild(style)
}

let dropTiles = (boardModel) => {
    let motionMatrix = boardModel.generateMotionMatrix()
    let tiles = document.getElementsByClassName('tile')
    for (let tile of tiles) {
        let row = tile.dataset.row
        let col = tile.dataset.col
        let distance = motionMatrix[row][col]
        if (distance !== 0) {
            tile.classList.add(`drop-${distance}`)
        }
    }

}

export { initiateBoardSpecs, createBoardTemplate, updateBoardTemplate, dropTiles }