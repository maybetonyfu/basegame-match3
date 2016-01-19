
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
            // tile.classList.remove("entry")
            tile.style.opacity = 0
        }
        else {
            let tileValue = boardModel.elements[row][col]
            let symbol = symbolList[tileValue]
            tile.innerHTML = symbol
            tile.style.opacity = 1
            // tile.classList.add("entry")
        }
    }
}

let updateEntryClass = boardModel => {
    let tiles = document.getElementsByClassName('tile')
    for (let tile of tiles) {
        let row = tile.dataset.row
        let col = tile.dataset.col
        if (boardModel.elements[row][col] == -1) {
            tile.classList.remove("entry")
        }
        else {
            tile.classList.add("entry")
        }
    }
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

export {  updateBoardTemplate, dropTiles, updateEntryClass }