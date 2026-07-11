import React, { useReducer, useCallback, useEffect, useRef } from 'react'
import './App.css'

/* ── Game constants ── */
const SIZE = 4
const STORAGE_KEY = '2048-duolingo-best'

/* ── Color map for tiles (Duolingo palette) ── */
const TILE_COLORS = {
  0:    { bg: '#D6E8C8', text: '#00000000' },
  2:    { bg: '#E8F5DC', text: '#3C9600' },
  4:    { bg: '#C8E6C9', text: '#3C9600' },
  8:    { bg: '#A5D6A7', text: '#1B5E20' },
  16:   { bg: '#81C784', text: '#FFFFFF' },
  32:   { bg: '#66BB6A', text: '#FFFFFF' },
  64:   { bg: '#4CAF50', text: '#FFFFFF' },
  128:  { bg: '#FDD835', text: '#3C9600' },
  256:  { bg: '#FFC107', text: '#3C9600' },
  512:  { bg: '#FF9800', text: '#FFFFFF' },
  1024: { bg: '#F57C00', text: '#FFFFFF' },
  2048: { bg: '#E65100', text: '#FFFFFF' },
}

function tileColor(value) {
  return TILE_COLORS[value] || { bg: '#BF360C', text: '#FFFFFF' }
}

/* ── Helpers ── */
function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneGrid(grid) {
  return grid.map(row => [...row])
}

function getEmptyCells(grid) {
  const cells = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) cells.push([r, c])
  return cells
}

function addRandom(grid) {
  const empty = getEmptyCells(grid)
  if (!empty.length) return grid
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const g = cloneGrid(grid)
  g[r][c] = Math.random() < 0.9 ? 2 : 4
  return g
}

function slideRow(row) {
  let arr = row.filter(v => v !== 0)
  let score = 0
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2
      score += arr[i]
      arr.splice(i + 1, 1)
    }
  }
  while (arr.length < SIZE) arr.push(0)
  return { row: arr, score }
}

function moveLeft(grid) {
  let g = [], s = 0
  for (let r = 0; r < SIZE; r++) {
    const { row, score } = slideRow(grid[r])
    g.push(row); s += score
  }
  return { grid: g, score: s }
}

function moveRight(grid) {
  let g = [], s = 0
  for (let r = 0; r < SIZE; r++) {
    const { row, score } = slideRow([...grid[r]].reverse())
    g.push(row.reverse()); s += score
  }
  return { grid: g, score: s }
}

function moveUp(grid) {
  let g = emptyGrid(), s = 0
  for (let c = 0; c < SIZE; c++) {
    const col = grid.map(row => row[c])
    const { row, score } = slideRow(col)
    for (let r = 0; r < SIZE; r++) g[r][c] = row[r]
    s += score
  }
  return { grid: g, score: s }
}

function moveDown(grid) {
  let g = emptyGrid(), s = 0
  for (let c = 0; c < SIZE; c++) {
    const col = []
    for (let r = SIZE - 1; r >= 0; r--) col.push(grid[r][c])
    const { row, score } = slideRow(col)
    for (let r = SIZE - 1; r >= 0; r--) g[r][c] = row[SIZE - 1 - r]
    s += score
  }
  return { grid: g, score: s }
}

function equals(a, b) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (a[r][c] !== b[r][c]) return false
  return true
}

function canMove(grid) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true
    }
  return false
}

function hasWon(grid) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 2048) return true
  return false
}

/* ── Reducer ── */
const MOVES = { left: moveLeft, right: moveRight, up: moveUp, down: moveDown }

function initState() {
  let grid = addRandom(addRandom(emptyGrid()))
  return {
    grid,
    score: 0,
    best: parseInt(localStorage.getItem(STORAGE_KEY)) || 0,
    gameOver: false,
    won: false,
    keepPlaying: false,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'MOVE': {
      if (state.gameOver || (state.won && !state.keepPlaying)) return state
      const dir = action.dir
      const fn = MOVES[dir]
      if (!fn) return state
      const { grid: newGrid, score: added } = fn(state.grid)
      if (equals(newGrid, state.grid)) return state

      let grid = addRandom(newGrid)
      const total = state.score + added
      const best = Math.max(total, state.best)
      localStorage.setItem(STORAGE_KEY, best)

      const won = !state.won && !state.keepPlaying && hasWon(grid)
      const over = !won && !canMove(grid)

      return { ...state, grid, score: total, best, gameOver: over, won }
    }
    case 'NEW_GAME':
      return { ...initState() }
    case 'CONTINUE':
      return { ...state, keepPlaying: true, won: false }
    default:
      return state
  }
}

/* ── Swipe hook ── */
function useSwipe(onSwipe) {
  const ref = useRef(null)
  const start = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    }

    const handleTouchEnd = (e) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < 30) return // too short

      if (absDx > absDy) {
        onSwipe(dx > 0 ? 'right' : 'left')
      } else {
        onSwipe(dy > 0 ? 'down' : 'up')
      }
      start.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onSwipe])

  return ref
}

/* ── Component ── */
export default function App() {
  const [state, dispatch] = useReducer(reducer, null, initState)
  const { grid, score, best, gameOver, won } = state

  const handleMove = useCallback((dir) => {
    dispatch({ type: 'MOVE', dir })
  }, [])

  const onSwipe = useCallback((dir) => handleMove(dir), [handleMove])

  useEffect(() => {
    const handler = (e) => {
      const map = {
        ArrowLeft: 'left', ArrowRight: 'right',
        ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = map[e.key]
      if (dir) { e.preventDefault(); handleMove(dir) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleMove])

  const boardRef = useSwipe(onSwipe)

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-top">
          <h1 className="title">2048</h1>
          <div className="scores">
            <div className="score-box">
              <span className="score-label">PONTUAÇÃO</span>
              <span className="score-value">{score}</span>
            </div>
            <div className="score-box best">
              <span className="score-label">MELHOR</span>
              <span className="score-value">{best}</span>
            </div>
          </div>
        </div>
        <p className="subtitle">Junte os números até chegar em <strong>2048</strong>!</p>
      </header>

      {/* ── Board ── */}
      <div className="board-wrapper" ref={boardRef}>
        <div className="board">
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={`cell ${cell ? 'cell-filled' : ''}`}
                style={{
                  '--cell-bg': tileColor(cell).bg,
                  '--cell-text': tileColor(cell).text,
                }}
              >
                {cell !== 0 && (
                  <span className="cell-num">{cell}</span>
                )}
              </div>
            ))
          )}

          {/* ── Overlays ── */}
          {gameOver && (
            <div className="overlay">
              <div className="overlay-box">
                <span className="overlay-icon">😢</span>
                <h2>Game Over!</h2>
                <p>Pontuação: {score}</p>
                <button className="btn" onClick={() => dispatch({ type: 'NEW_GAME' })}>
                  Tentar de Novo
                </button>
              </div>
            </div>
          )}
          {won && (
            <div className="overlay">
              <div className="overlay-box">
                <span className="overlay-icon">🎉</span>
                <h2>Você venceu!</h2>
                <p>Chegou ao 2048!</p>
                <div className="overlay-btns">
                  <button className="btn" onClick={() => dispatch({ type: 'CONTINUE' })}>
                    Continuar Jogando
                  </button>
                  <button className="btn btn-outline" onClick={() => dispatch({ type: 'NEW_GAME' })}>
                    Novo Jogo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        <button className="btn btn-new" onClick={() => dispatch({ type: 'NEW_GAME' })}>
          ✨ Novo Jogo
        </button>
      </div>

      {/* ── Instructions ── */}
      <p className="hint">
        Deslize os dedos ou use as setas do teclado para mover os números
      </p>
    </div>
  )
}
