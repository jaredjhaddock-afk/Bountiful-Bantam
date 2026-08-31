import { useState } from 'react'
import { useGames, type Game } from '../../state/gamesStore'
import { CheckIcon, NoIcon } from '../icons'

interface NewGameModalProps {
  onClose: () => void
  onCreated: (game: Game) => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NewGameModal({ onClose, onCreated }: NewGameModalProps) {
  const { createGame } = useGames()
  const [date, setDate] = useState(todayIso())
  const [opponent, setOpponent] = useState('')
  const [name, setName] = useState('')

  const handleConfirm = () => {
    const game = createGame({ date, opponent: opponent.trim() || null, name: name.trim() || null })
    onCreated(game)
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">New Game</span>
          <button onClick={handleConfirm} className="text-accent-teal" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Opponent (optional)</div>
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Corner Canyon"
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Label (optional)</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tuesday walkthrough"
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
