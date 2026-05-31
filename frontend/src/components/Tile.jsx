import { useState, useEffect, useRef } from 'react'

export default function Tile({ tile, timerMinutes, timerEnabled, onRemove }) {
  const { name, color, position, isActive, isOnDeck } = tile

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(null)
  const timerRef = useRef(null)
  const wasActive = useRef(false)

  useEffect(() => {
    if (isActive && !wasActive.current) {
      if (timerEnabled) {
        setSecondsLeft(timerMinutes * 60)
        timerRef.current = setInterval(() => {
          setSecondsLeft(s => (s <= 1 ? 0 : s - 1))
        }, 1000)
      }
      wasActive.current = true
    } else if (!isActive && wasActive.current) {
      clearInterval(timerRef.current)
      setSecondsLeft(null)
      wasActive.current = false
    }
    return () => clearInterval(timerRef.current)
  }, [isActive, timerEnabled, timerMinutes])

  const timerExpired = secondsLeft === 0
  const timerDisplay = secondsLeft !== null
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
    : null

  let borderClass = 'border-2 border-transparent'
  if (isActive) borderClass = 'border-2 border-white tile-active'
  else if (isOnDeck) borderClass = 'border-2 border-white/50 tile-ondeck'

  return (
    <div
      className={`relative rounded-xl p-4 select-none transition-all duration-200 ${borderClass} ${isActive ? 'scale-105 z-10' : ''}`}
      style={{ backgroundColor: color }}
    >
      {/* Position badge */}
      {position && (
        <div className="absolute top-2 left-2 bg-black/40 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {position}
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(name)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white text-xs flex items-center justify-center transition-colors"
        title="Remove from today's session"
      >
        ✕
      </button>

      {/* On Deck indicator */}
      {isOnDeck && (
        <div className="absolute bottom-2 right-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded">
          On Deck
        </div>
      )}

      {/* Name */}
      <div className="mt-4 text-center">
        <span className="text-white font-semibold text-base leading-tight break-words">
          {name}
        </span>
      </div>

      {/* Timer */}
      {timerDisplay && (
        <div className={`mt-2 text-center text-sm font-mono font-bold ${timerExpired ? 'text-red-300 animate-pulse' : 'text-white/80'}`}>
          {timerExpired ? '⏰ Time' : timerDisplay}
        </div>
      )}
    </div>
  )
}
