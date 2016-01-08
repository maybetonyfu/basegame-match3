"use strict"

import Board from "board"
import {createBoardTemplate, updateBoardTemplate} from "domwrapper"
import {swapEventHandler} from "swapEventHandler"
import {prepareBoard} from "boardController"

let board = new Board(7,7,5)

createBoardTemplate(board)
updateBoardTemplate(board)

let parentContainer = document.getElementsByClassName('board')[0];
parentContainer.addEventListener('click', swapEventHandler.bind(board), false);


prepareBoard(board)
