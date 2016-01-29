import updateBoard from "script/action/updateBoard"
import EventEngine from "script/model/EventEngine"

export default board => {
    let tiles = [...document.getElementsByClassName('tile')]
    let regeneratedTiles = new Set()

    tiles.forEach(tile => {
        let row = tile.dataset.row
        let col = tile.dataset.col
        if (board.elements[row][col] === -1) {

            tile.style.animation = "grow ease 600ms"
            tile.style.webkitAnimation = "grow ease 600ms"

            regeneratedTiles.add(tile)
            tile.addEventListener("animationend", onAnimationEnd, false)
        }
    })
    board.refillBoard()
    updateBoard(board)

    function onAnimationEnd (e) {
        console.log("element refill finish")
        let currentElement = e.target

        currentElement.style.animation = ""
        currentElement.style.webkitAnimation = ""

        regeneratedTiles.delete(currentElement)

        let elClone = currentElement.cloneNode(true);
        currentElement.parentNode.replaceChild(elClone, currentElement);

        if (regeneratedTiles.size === 0) {
            console.log("Refill Finished")
            EventEngine.emit("play.findMatch")

        }
    }

}