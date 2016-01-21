export default boardModel => {
    let symbolList = ["🍏", "🍌", "🍐", "🍒", "🍆", "🍉", "🍇", "🍓"]
    let tiles = document.getElementsByClassName('tile')
    for (let tile of tiles) {
        let row = tile.dataset.row
        let col = tile.dataset.col

        if (boardModel.elements[row][col] == -1) {
            tile.style.opacity = 0
        }
        else {
            let tileValue = boardModel.elements[row][col]
            let symbol = symbolList[tileValue]
            tile.innerHTML = symbol
            tile.style.opacity = 1
        }
    }
}