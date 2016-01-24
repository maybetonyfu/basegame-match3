import updateBoard from "script/action/updateBoard"
import EventEngine from "script/model/EventEngine"

export default (elements, board) => {


    let elA = elements[0]
    let elB = elements[1]

    let animationEnd = false

    let pointA = [elA.dataset.row, elA.dataset.col]
    let pointB = [elB.dataset.row, elB.dataset.col]

    let duration = 300


    if (elA.dataset.row === elB.dataset.row) {
        if (elA.dataset.col < elB.dataset.col) {
            console.log("horizontal")
            elA.style.animation = "left-to-right 1s ease"
            elB.style.animation = "right-to-left 1s ease"
        }
        else {
            console.log("horizontal reverse")
            elA.style.animation = "right-to-left 1s ease"
            elB.style.animation = "left-to-right 1s ease"
        }
    }

    if (elA.dataset.col === elB.dataset.col) {
        if (elA.dataset.row < elB.dataset.row) {
            console.log("vertical")
            elA.style.animation = "top-to-bottom 1s ease"
            elB.style.animation = "bottom-to-top 1s ease"
        }
        else {
            console.log("vertical reverse")
            elA.style.animation = "bottom-to-top 1s ease"
            elB.style.animation = "top-to-bottom 1s ease"
        }
    }

    elA.addEventListener("animationend", onAnimationEnd, false);
    elB.addEventListener("animationend", onAnimationEnd, false);

    // elB.addEventListener("animationend", onAnimationEnd, false);


    function onAnimationEnd () {
        if (!animationEnd) {
            animationEnd = true
            return
        }

        elA.style.animation = ""
        elB.style.animation = ""

        let elCloneA = elA.cloneNode(true);
        elA.parentNode.replaceChild(elCloneA, elA);

        let elCloneB = elB.cloneNode(true);
        elB.parentNode.replaceChild(elCloneB, elB);

        console.log("Update swap")

        board.swap(pointA, pointB)
        updateBoard(board)
        EventEngine.emit("play.findMatch")
    }

}
