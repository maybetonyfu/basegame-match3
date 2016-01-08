"use strict"
/*
Handle the event attatched to .board DOM element
Add clicked item to a size 2 queue and swap if move is legal
*/

import { updateBoardTemplate } from "script/view/boardView"
import { prepareBoard } from "script/controller/boardController"

let tappedQueue = []
let swapEventHandler = function (e) {
    if (e.target !== e.currentTarget) {
        let tappedItem = e.target
        if (tappedItem.classList.contains("tile")) {
            addToQueue(tappedItem, tappedQueue)
        } else {
            //better way to handle if click is on board but not tile
            throw new Error("Invalid click on the board")
        }
        
    }
    e.stopPropagation()
    if (isLegalMove(tappedQueue)) {
        let pointA = [tappedQueue[0].dataset.row, tappedQueue[0].dataset.col]
        let pointB = [tappedQueue[1].dataset.row, tappedQueue[1].dataset.col]
        this.swap(pointA, pointB)
        updateBoardTemplate(this)
        prepareBoard(this)
        tappedQueue = []
    }
}

let addToQueue = function (item, queue) {
  if (queue.length === 2) queue.pop()
  if (queue[0] !== item) {
    queue.push(item)
  }
}

let isLegalMove = function (queue) {
    if (queue.length < 2) return false
    let rowA = queue[0].dataset.row
    let colA = queue[0].dataset.col
    let rowB = queue[1].dataset.row
    let colB = queue[1].dataset.col
    if (Math.abs(rowA - rowB) + Math.abs(colA - colB) == 1) {
        return true
    } else {
        return false
    }
}

export { swapEventHandler }