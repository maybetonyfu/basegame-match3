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
        @keyframes left-to-right {
            0% {
                transform: translateX(0);
            }
            100% {
                transform: translateX(${tileOuter}px);
            }
        }
        @keyframes right-to-left {
            0% {
                transform: translateX(0);
            }
            100% {
                transform: translateX(-${tileOuter}px);
            }
        }
        @keyframes top-to-bottom {
            0% {
                transform: translateY(0);
            }
            100% {
                transform: translateY(${tileOuter}px);
            }
        }
        @keyframes bottom-to-top {
            0% {
                transform: translateY(0);
            }
            100% {
                transform: translateY(-${tileOuter}px);
            }
        }
        `
    document.getElementsByTagName('head')[0].appendChild(style)

    EventEngine.emit('initiate.board')
}