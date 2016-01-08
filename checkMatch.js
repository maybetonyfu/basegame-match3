"use strict"

export let checkMatch = function (list) {
    if( !list.length || list.length < 2 ) {
        console.error("Cannot cascade a non-array object or too short")
        return
    }
    let match = []
    let combo = false
    for (var index = 0; index < list.length - 2; index = index + 1) {
        if (list[index] === list[index + 1] && list[index] === list[index + 2]) {
            if (combo) {
                match.push(index + 2)
            } else {
                combo = true
                match.push(index)
                match.push(index + 1)
                match.push(index + 2)
            }

        } else {
            combo = false
        }
    }
    return match
}