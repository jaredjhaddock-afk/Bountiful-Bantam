import { useState } from 'react'
import { useGames, type Game } from '../../state/gamesStore'
import { useClips } from '../../state/clipsStore'
import { gameLabel } from '../../lib/gameLabel'
import { CalendarIcon, PlusIcon, TrashIcon } from '../icons'
import { DeleteConfirmModal } from '../playbook/DeleteConfirmModal'
import { NewGameModal } from './NewGameModal'

interface GamesLibraryProps {
  onOpenGame: (gameId: string | null) => void
}

export function GamesLibrary({ onOpenGame }: GamesLibraryProps) {
  const { loading, games, deleteGame } = useGames()
  const { clips } = useClips()
  const [addingGame, setAddingGame] = useState(false)
  const [deleting, setDeleting] = useState<Game | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Clips are already loaded in full by ClipsProvider (used across the whole Video
  // Review flow at once), so counting per game here is a plain client-side reduce —
  // no extra query needed, unlike bookmark counts which come from a table this
  // component doesn't otherwise load.
  const clipCount = (gameId: string | null) => clips.filter((c) => c.gameId === gameId).length

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteGame(deleting.id)
      setDeleting(null)
    } catch {
      setDeleteError('Could not delete this game. Try again.')
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setAddingGame(true)}
          disabled={loading}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add game</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading games…</p>}
        {games.map((game) => (
          <div
            key={game.id}
            className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
          >
            <button onClick={() => onOpenGame(game.id)} className="flex flex-1 flex-col justify-between text-left text-muted hover:text-text">
              <div className="flex items-center justify-between">
                <CalendarIcon width={16} height={16} />
                <span className="text-[10px]">{clipCount(game.id)} clip{clipCount(game.id) === 1 ? '' : 's'}</span>
              </div>
              <div className="truncate text-sm text-text">{gameLabel(game)}</div>
            </button>
            <button
              onClick={() => {
                setDeleting(game)
                setDeleteError(null)
              }}
              aria-label="Delete game"
              className="self-end text-muted hover:text-alert-red"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onOpenGame(null)}
          className="flex h-32 w-56 flex-col justify-center gap-1 rounded-standard border border-white/10 bg-panel p-3 text-left text-muted hover:border-accent-teal hover:text-text"
        >
          <span className="text-sm text-text">Unassigned</span>
          <span className="text-[10px] uppercase">
            {clipCount(null)} clip{clipCount(null) === 1 ? '' : 's'} not in a game
          </span>
        </button>
      </div>
      {addingGame && (
        <NewGameModal
          onClose={() => setAddingGame(false)}
          onCreated={(game) => {
            setAddingGame(false)
            onOpenGame(game.id)
          }}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          itemName={gameLabel(deleting)}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null)
            setDeleteError(null)
          }}
        />
      )}
    </div>
  )
}
