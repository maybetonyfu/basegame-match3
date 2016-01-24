import updateBoard from "script/action/updateBoard"

export default board => {

    let matches = board.match
    let matchedElements = new Set()
    matches.forEach(match => {

        let row = match[0]
        let col = match[1]

        let tile = document.getElementsByClassName(`row-${row} col-${col}`)[0]

        tile.style.animation = "mark 1s ease"
        matchedElements.add(tile)

        tile.addEventListener("animationend", onAnimationEnd, false)
    })

    function onAnimationEnd(e) {
        let currentElement = e.target
        currentElement.style.animation = ""

        matchedElements.delete(currentElement)

        let elClone = currentElement.cloneNode(true);
        currentElement.parentNode.replaceChild(elClone, currentElement);

        if (matchedElements.size === 0) {
            //emit event
            board.removeMatch()
            updateBoard(board)

        }
    }

}