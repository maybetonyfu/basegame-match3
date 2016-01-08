"use strict"

export let cascade = function (list) {
    let length = list.length
    let after
    if( !length || length < 2 ) {
        console.error("Cannot cascade a non-array object or too short")
        return
    }
    after = list.filter(value => value >= 0)
    return Array(length - after.length).fill(-1).concat(after)
}