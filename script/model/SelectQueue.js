"use strict"


export default class SelectQueue {

    constructor() {
        let elements = []
        this.elements = elements
    }

    add(item) {
        if (this.isFull()) this.elements.pop()
        if (this.elements[0] !== item) {
            this.elements.push(item)
        }
    }
    reset() {
        this.elements = []
    }

    isFull() {
        return this.elements.length === 2
    }

    isLegal(fn) {
        if (!this.isFull()) return false
        return fn(this.elements)
    }
}
