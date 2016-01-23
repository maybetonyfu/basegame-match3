export default (elements) => {
    let elA = elements[0]
    let elB = elements[1]
    let pointA = [+elA.dataset.row, +elA.dataset.col]
    let pointB = [+elB.dataset.row, +elB.dataset.col]
    let duration = 300

    if (elA.dataset.row === elB.dataset.row) {
        if (elA.dataset.col < elB.dataset.col) {
            console.log("horizontal")
            elA.style.animation = "left-to-right 1s ease"
            elB.style.animation = "right-to-left 1s ease"
        }
        else {
            console.log("horizontal reverse")
            elA.style.animation = "right-to-left 1s ease"
            elB.style.animation = "left-to-right 1s ease"
        }
    }

    if (elA.dataset.col === elB.dataset.col) {
        if (elA.dataset.row < elB.dataset.row) {
            console.log("vertical")
            elA.style.animation = "top-to-bottom 1s ease"
            elB.style.animation = "bottom-to-top 1s ease"
        }
        else {
            console.log("vertical reverse")
            elA.style.animation = "bottom-to-top 1s ease"
            elB.style.animation = "top-to-bottom 1s ease"
        }
    }

    elA.addEventListener("animationend", () => {}, false);
    elB.addEventListener("animationend", () => {}, false);
}
