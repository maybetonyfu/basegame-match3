"use strict"
/*
Handle the event attatched to .board DOM element
Add clicked item to a size 2 queue and swap if move is legal
*/

let select = function (e, queue) {
    if (e.target !== e.currentTarget) {

        let tappedItem = e.target

        if (tappedItem.classList.contains("tile")) {

            queue.add(tappedItem)

            console.log(queue)

        }
        else {
            //better way to handle if click is on board but not tile
            throw new Error("Invalid click on the board")

        }

    }

    e.stopPropagation()

}

export default select