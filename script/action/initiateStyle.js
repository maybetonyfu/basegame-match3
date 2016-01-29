import EventEngine from "script/model/EventEngine"

export default (boardModel) => {

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
        @-webkit-keyframes left-to-right {
            0% {
                -webkit-transform: translateX(0);
                        transform: translateX(0);
            }
            100% {
                -webkit-transform: translateX(${tileOuter}px);
                        transform: translateX(${tileOuter}px);
            }
        }
        @keyframes left-to-right {
            0% {
                -webkit-transform: translateX(0);
                        transform: translateX(0);
            }
            100% {
                -webkit-transform: translateX(${tileOuter}px);
                        transform: translateX(${tileOuter}px);
            }
        }
        @-webkit-keyframes right-to-left {
            0% {
                -webkit-transform: translateX(0);
                        transform: translateX(0);
            }
            100% {
                -webkit-transform: translateX(-${tileOuter}px);
                        transform: translateX(-${tileOuter}px);
            }
        }
        @keyframes right-to-left {
            0% {
                -webkit-transform: translateX(0);
                        transform: translateX(0);
            }
            100% {
                -webkit-transform: translateX(-${tileOuter}px);
                        transform: translateX(-${tileOuter}px);
            }
        }
        @-webkit-keyframes top-to-bottom {
            0% {
                -webkit-transform: translateY(0);
                        transform: translateY(0);
            }
            100% {
                -webkit-transform: translateY(${tileOuter}px);
                        transform: translateY(${tileOuter}px);
            }
        }
        @keyframes top-to-bottom {
            0% {
                -webkit-transform: translateY(0);
                        transform: translateY(0);
            }
            100% {
                -webkit-transform: translateY(${tileOuter}px);
                        transform: translateY(${tileOuter}px);
            }
        }
        @-webkit-keyframes bottom-to-top {
            0% {
                -webkit-transform: translateY(0);
                        transform: translateY(0);
            }
            100% {
                -webkit-transform: translateY(-${tileOuter}px);
                        transform: translateY(-${tileOuter}px);
            }
        }
        @keyframes bottom-to-top {
            0% {
                -webkit-transform: translateY(0);
                        transform: translateY(0);
            }
            100% {
                -webkit-transform: translateY(-${tileOuter}px);
                        transform: translateY(-${tileOuter}px);
            }
        }
        `

    for (let row = 1; row < boardModel.rows; row ++) {
        let dropDistance = row * tileOuter
        style.innerHTML += `
        @-webkit-keyframes drop-${row} {
             0% {
                ransform: translateY(0px);
            }
            100% {
                -webkit-transform: translateY(${dropDistance}px);
                        transform: translateY(${dropDistance}px);
            }
        }
        @keyframes drop-${row} {
             0% {
                ransform: translateY(0px);
            }
            100% {
                -webkit-transform: translateY(${dropDistance}px);
                        transform: translateY(${dropDistance}px);
            }
        }
        `
    }
    document.getElementsByTagName('head')[0].appendChild(style)

    EventEngine.emit('initiate.board')
}