"use strict"

export let generateMotionVector =  (list) => {
    let distance = 0
    return list.reverse().map(value => {
        if (value == -1) {
            distance ++
            return 0
        } else {
            return distance
        }
    }).reverse()
}