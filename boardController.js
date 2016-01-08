"use strict"

import {updateBoardTemplate} from "domwrapper"

let findMatch = function (boardModel) { 
    return new Promise(
        resolve => {
            boardModel.findMatch()
            setTimeout(
                () => {
                    resolve(boardModel)
                },
                300)
        }
    )
}

let removeMatch = function (boardModel) {
        return new Promise(
        resolve => {
            boardModel.removeMatch()
            updateBoardTemplate(boardModel)
            setTimeout(
                () => {
                    resolve(boardModel)
                },
                300)
        })
    }

let cascadeBoard = function (boardModel) {
        return new Promise(
        resolve => {
            boardModel.cascadeBoard()
            updateBoardTemplate(boardModel)
            setTimeout(
                () => {
                    resolve(boardModel)
                },
                300)
        })
    }

let refillBoard = function (boardModel) {
        return new Promise(
        resolve => {
            boardModel.refillBoard()
            updateBoardTemplate(boardModel)
            setTimeout(
                () => {
                    resolve(boardModel)
                },
                300)
        })
    }



let prepareBoard = function (boardModel) {
    boardModel.findMatch()
    if ( boardModel.match.length === 0 ) {
        return
    }
    removeMatch(boardModel)
    .then(cascadeBoard)
    .then(refillBoard)
    .then(() => {
        prepareBoard(boardModel)
    })
}
export { prepareBoard }