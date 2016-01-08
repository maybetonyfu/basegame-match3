"use strict"

import { checkMatch } from "checkMatch"
import { cascade } from "cascade"
import { generateMotionVector } from "generateMotionVector"
import { transposeMatrix } from "transposeMatrix"

export default class Board {
    constructor(rows, cols, species) {
        this.rows = rows
        this.cols = cols
        this.species = species
        this.match = []
        this.elements = Array(rows)
            .fill([])
            .map(() => {
                return Array(cols)
                    .fill(0)
                    .map(() => {
                        return Math.floor(Math.random() * species)
            })
        })
    }
    getCell(point) {
        let x = point[0]
        let y = point[1]
        return this.elements[x][y]
    }
    setCell(point, value) {
        let x = point[0]
        let y = point[1]
        this.elements[x][y] = value
    }
    getRow(i) {
        return this.elements[i]
    }
    setRow(i, list) {
        this.elements[i] = list
    }
    getCol(i) {
        return this.elements.map( r => r[i] )
    }
    setCol(index, list) {
        this.elements.forEach((row, rowIndex) => {
            row[index] = list[rowIndex]
        })
    }
    findMatch() {
        let row = this.rows
        let col = this.cols
        let matchList = []
        while (row--) {
            let rowElements = this.getRow(row)
            let rowResult = checkMatch(rowElements)
            for (let match of rowResult) {
                 matchList.push([row, match])
            }
        }
        while (col--) {
            let colElements = this.getCol(col)
            let colResult = checkMatch(colElements)
            for (let match of colResult) {
                matchList.push([match, col])
            }
        }
        this.match = matchList
    }
    removeMatch(){
        this.match.forEach(match => {
            this.setCell(match, -1)
        })
        this.match = []
    }
    cascadeBoard () {
        let col = this.cols
        while (col--) {
            let colElements = this.getCol(col)
            let sortedCol = cascade(colElements)
            this.setCol(col, sortedCol)
        }
    }
    refillBoard () {
        let species = this.species
        this.elements.forEach((row, index) => {
            this.elements[index] = row.map(col => {
                return (col === -1) ? 
                    Math.floor(Math.random() * species) : 
                    col
            })
        })
    }
    swap (pointA, pointB) {
        let temp = this.getCell(pointA)
        this.setCell(pointA, this.getCell(pointB))
        this.setCell(pointB, temp)
    }
    transposeBoard(){
        return transposeMatrix(this.elements)
    }
    generateMotionMatrix () {
        let T =transposeMatrix(this.elements)
            .map(col => generateMotionVector(col))
        return transposeMatrix(T)
    }
}