export default boardModel => {

    // calculate board size specs
    let windowWidth = document.documentElement.clientWidth
    let windowHeight = document.documentElement.clientHeight
    let windowShorterSide = Math.min(windowWidth, windowHeight)
    let boardLonggerSide = Math.max(boardModel.rows, boardModel.cols)
    let tileOuter = windowShorterSide / boardLonggerSide
    let boardHeight = tileOuter * boardModel.rows
    let boardWidth = tileOuter * boardModel.cols
    let tileGutter = 5
    let tileInner = tileOuter - 2 * tileGutter
    let padding = tileInner / 2

    // write to document header css
    let style = document.createElement('style')
    style.type = 'text/css'
    style.innerHTML = `
        .board {
            height: ${boardHeight}px;
            width: ${boardWidth}px;
        }
        .row {
            height: ${tileOuter}px;
            width: ${boardWidth}px;
        }
        .tile {
            width: ${tileInner}px;
            height: ${tileInner}px;
            line-height: ${tileInner}px;
            margin: ${tileGutter}px;
            font-size: ${padding}px;
        }
        .up {
            animation: bottom-to-top ease-in-out 0.8s;
        }
        .down {
            animation: top-to-bottom ease-in-out 0.8s;
        }
        .left {
            animation: right-to-left ease-in-out 0.8s;
        }
        .right {
            animation: left-to-right ease-in-out 0.8s;
        }
        @keyframes left-to-right {
            0% {
                transform: translateX(0px);
            }
            100 % {
                transform: translateX(${tileOuter}px);
            }
        }
        @keyframes right-to-left {
            0% {
                transform: translateX(0px);
            }
            100 % {
                transform: translateX(-${tileOuter}px);
            }
        }
        @keyframes top-to-bottom {
            0% {
                transform: translateY(0px);
            }
            100 % {
                transform: translateY(${tileOuter}px);
            }
        }
        @keyframes bottom-to-top {
            0% {
                transform: translateY(0px);
            }
            100 % {
                transform: translateY(-${tileOuter}px);
            }
        }
        `
    for (let row = 1; row < boardModel.rows; row ++) {
        let dropDistance = row * tileOuter
        let transitionDelay = row * 10
        let duration = 300
        style.innerHTML += `
            .drop-${row} {
                z-index: 1;
                transition: transform ${duration}ms ease-in ${transitionDelay}ms;
                transform: translateY(${dropDistance}px);
            }
            `
    }
    document.getElementsByTagName('head')[0].appendChild(style)
}