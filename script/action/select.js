"use strict"

import EventEngine from "script/model/EventEngine"
/*
Handle the event attatched to .board DOM element
Add clicked item to a size 2 queue and swap if move is legal
*/

let select = function (e, queue) {
    if (e.target !== e.currentTarget) {
        let tappedItem = e.target
        if (tappedItem.classList.contains("tile")) {
            queue.add(tappedItem)

            if (queue.isFull()) {
                queue.elements[0].style.animation = '';
                queue.elements[1].style.animation = '';

                if(queue.isLegal(adjasent)) {
                    EventEngine.emit("play.swap")
                    //queue.reset()
                }
                else {
                    console.log("Not Legal!")
                    queue.reset()

                }
            }
            else {
                tappedItem.style.animation = 'breath 3s ease infinite';
            }
            // console.log(queue)
        }
        else {
            //better way to handle if click is on board but not tile
            throw new Error("Invalid click on the board")
        }
    }
    e.stopPropagation()
}

let adjasent = function (els) {
    let elA = els[0]
    let elB = els[1]
    let rowA = elA.dataset.row
    let colA = elA.dataset.col
    let rowB = elB.dataset.row
    let colB = elB.dataset.col
    return Math.abs(rowA - rowB) + Math.abs(colA - colB) == 1
}

export default select