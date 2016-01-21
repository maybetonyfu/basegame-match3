"use strict"


export default class SelectQueue {

    constructor() {
        let queue = []
        this.queue = queue
    }

    add(item) {
        if (this.isFull()) this.queue.pop()
        if (this.queue[0] !== item) {
            this.queue.push(item)
        }
    }
    reset() {
        this.queue = []
    }

    isFull() {
        return this.queue.length === 2
    }

    isLegal(fn) {
        if (!this.isFull()) return false
        //do something here
    }
}
