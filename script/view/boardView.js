
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
    let tiles = document.getElementsByClassName('tile');
    for (let tile of tiles) {
        let row = tile.dataset.row
        let col = tile.dataset.col
        if (boardModel.elements[row][col] == -1) {
            tile.innerHTML = ""
        }
        else tile.innerHTML = boardModel.elements[row][col]
    }
}

export { createBoardTemplate,updateBoardTemplate }