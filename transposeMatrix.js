"use strict"

export let transposeMatrix = (matrix) => {
    let T = []
    matrix.forEach((row, rowIndex) => {
        row.forEach((col, colIndex) =>{
            if(!T[colIndex]) T[colIndex] = []
            T[colIndex].push(col)
        })
    })
    return T
}