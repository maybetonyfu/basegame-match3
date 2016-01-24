import updateBoard from "script/action/updateBoard"
import EventEngine from "script/model/EventEngine"

export default board => {

    let tiles = [...document.getElementsByClassName('tile')]
    let dropTiles = new Set()
    let MotionMatrix = board.generateMotionMatrix()


    tiles.forEach(tile => {
        let row = tile.dataset.row
        let col = tile.dataset.col
        let dropDistance = MotionMatrix[row][col]

        if (dropDistance !== 0) {
            tile.style.animation = `drop-${dropDistance} 550ms ease`
            tile.addEventListener("animationend", onAnimationEnd, false)
            dropTiles.add(tile)
        }

    })
    if (dropTiles.size === 0) {
        EventEngine.emit("play.refillBoard")
    }

    function onAnimationEnd (e) {
        console.log("element drop finish")
        let currentElement = e.target
        currentElement.style.animation = ""

        dropTiles.delete(currentElement)

        let elClone = currentElement.cloneNode(true);
        currentElement.parentNode.replaceChild(elClone, currentElement);

        if (dropTiles.size === 0) {
            console.log("Drop Finished")
            board.cascadeBoard()
            updateBoard(board)
            EventEngine.emit("play.refillBoard")

        }
    }

}