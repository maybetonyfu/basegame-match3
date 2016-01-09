"use strict"

import Board from "script/model/board"
import { initiateBoardSpecs, createBoardTemplate, updateBoardTemplate } from "script/view/boardView"
import { swapEventHandler } from "script/event/swap"
import { prepareBoard } from "script/controller/boardController"

let board = new Board(6,6,4)

initiateBoardSpecs(board)
createBoardTemplate(board)
updateBoardTemplate(board)

let parentContainer = document.getElementsByClassName('board')[0];
parentContainer.addEventListener('click', swapEventHandler.bind(board), false);


prepareBoard(board)
