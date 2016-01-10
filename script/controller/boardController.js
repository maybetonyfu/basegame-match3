"use strict"

import { updateBoardTemplate, dropTiles } from "script/view/boardView"

let waiting = function (flow) {
    return new Promise(
        resolve => {
            setTimeout(
            () => {
                resolve({
                    boardModel: flow.boardModel,
                    delay: flow.delay
                })
            },
            flow.delay)
        }
    )
}

let findMatch = function (flow) { 
    return new Promise(
        resolve => {
            flow.boardModel.findMatch()
            resolve({
                boardModel: flow.boardModel,
                delay: flow.delay
            })
        }
    )
}

let removeMatch = function (flow) {
    return new Promise(
        resolve => {
            flow.boardModel.removeMatch()
            updateBoardTemplate(flow.boardModel)
            resolve({
                boardModel: flow.boardModel,
                delay: flow.delay
            })
        })
    }

let dropTilesAnimation = function (flow) {
    return new Promise(
        resolve => {
            dropTiles(flow.boardModel)
            resolve({
                boardModel: flow.boardModel,
                delay: flow.delay
            })
        })
    }

let cascadeBoard = function (flow) {
    return new Promise(
        resolve => {
            flow.boardModel.cascadeBoard()
            updateBoardTemplate(flow.boardModel)
            resolve({
                boardModel: flow.boardModel,
                delay: flow.delay
            })
        })
    }

let refillBoard = function (flow) {
    return new Promise(
        resolve => {
            flow.boardModel.refillBoard()
            updateBoardTemplate(flow.boardModel)
            resolve({
                boardModel: flow.boardModel,
                delay: flow.delay
            })
        })
    }



let prepareBoard = function (boardModel) {
    boardModel.findMatch()
    if ( boardModel.match.length === 0 ) {
        return
    }
    
    waiting({
        boardModel: boardModel,
        delay: 250
    })
    .then(removeMatch)
    .then(dropTilesAnimation)
    .then(waiting)
    .then(cascadeBoard)
    .then(waiting)
    .then(refillBoard)
    .then(waiting)
    .then(() => {
        prepareBoard(boardModel)
    })
}
export { prepareBoard }