"use strict"

import Board from "script/model/Board"
import select from "script/action/select"
import swap from "script/action/swap"
import initiateBoard from "script/action/initiateBoard"
import initiateStyle from "script/action/initiateStyle"
import updateBoard from "script/action/updateBoard"
import markMatch from "script/action/markMatch"
import dropTiles from "script/action/dropTiles"
import refillBoard from "script/action/refillBoard"
import EventEngine from "script/model/EventEngine"
import SelectQueue from "script/model/SelectQueue"

let selectQueue = new SelectQueue()

let board = new Board(6,6,4)

EventEngine.addListener("initiate.board", () => {
    console.info("Initiating Board")
    initiateBoard(board)
    EventEngine.emit("initiate.findMatch")
})

EventEngine.addListener("initiate.findMatch", () => {
    console.info("Finding Match")
    board.findMatch()
    if(board.match.length !== 0) {
        console.info("Match Found Proceeding Next Process")
        EventEngine.emit("initiate.removeMatch")
    }
    else {
        console.info("No Match Found Game Start")
        EventEngine.emit("initiate.updateBoard")
    }
})

EventEngine.addListener("initiate.removeMatch", () => {
    console.info("Removing Match")
    board.removeMatch()
    EventEngine.emit("initiate.cascadeBoard")
})

EventEngine.addListener("initiate.cascadeBoard", () => {
    console.info("Cascading")
    board.cascadeBoard()
    EventEngine.emit("initiate.refillBoard")
})

EventEngine.addListener("initiate.refillBoard", () => {
    console.info("Refilling")
    board.refillBoard()
    EventEngine.emit("initiate.findMatch")
})

EventEngine.addListener("initiate.updateBoard", () => {
    console.info("Rendering")
    updateBoard(board)
})


EventEngine.addListener("play.swap", () => {
    console.info("Swapping Selected Tiles")
    let elements = selectQueue.elements
    swap(elements, board)
    selectQueue.reset()
})

EventEngine.addListener("play.findMatch", () => {
    console.info("Finding Match")
    board.findMatch()
    if(board.match.length !== 0) {
        console.info("Match Found Proceeding Next Process")
        markMatch(board)
        //EventEngine.emit("initiate.removeMatch")
    }
    else {
        console.info("No Match Found Game Continue")
        //EventEngine.emit("initiate.updateBoard")
    }
})

EventEngine.addListener("play.dropTiles", () => {
    console.info("Now drop floating tiles")
    dropTiles(board)
})

EventEngine.addListener("play.refillBoard", () => {
    console.info("Now refill some new tiles")
    refillBoard(board)
})

initiateStyle(board)

let parentContainer = document.getElementsByClassName('board')[0];

parentContainer.addEventListener('click', e => {
    select(e, selectQueue)
}, false);
