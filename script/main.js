"use strict"

import Board from "script/model/Board"
import {  updateBoardTemplate } from "script/view/boardView"
import { swapEventHandler } from "script/event/swap"
import { prepareBoard } from "script/controller/boardController"
import initiateBoard from "script/view/initiateBoard"
import initiateStyle from "script/view/initiateStyle"
import EventEngine from "script/model/EventEngine"


let board = new Board(6,6,4)

EventEngine.addListener("board.initiate", () => { console.info("board is ready") })
EventEngine.addListener("document.style", () => { console.info("inline style is ready") })

initiateStyle(board)
initiateBoard(board)
updateBoardTemplate(board)

let parentContainer = document.getElementsByClassName('board')[0];
parentContainer.addEventListener('click', swapEventHandler.bind(board), false);


//prepareBoard(board)
