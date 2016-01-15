"use strict"

export let cascade = function (list) {
    let length = list.length
    if( !length || length < 2 ) {
        console.error("Cannot cascade a non-array object or too short")
        return
    }
    let after = list.filter(value => value >= 0)
    return [...Array(length - after.length).fill(-1), ...after]
}