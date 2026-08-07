import { FilmIcon, InfoIcon, LockIcon, NotesIcon, PersonnelIcon, PlayIcon, RouteIcon } from '../icons'

interface EditorToolbarProps {
  locked: boolean
  onToggleLock: () => void
  annotationsOpen: boolean
  onToggleAnnotations: () => void
}

export function EditorToolbar({ locked, onToggleLock, annotationsOpen, onToggleAnnotations }: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-6 border-b border-white/10 bg-app-bg py-2 text-muted">
      <button className="hover:text-text" aria-label="Info">
        <InfoIcon />
      </button>
      <button
        onClick={onToggleLock}
        className={locked ? 'rounded-standard bg-surface-2 p-1 text-text' : 'hover:text-text'}
        aria-label="Lock"
      >
        <LockIcon />
      </button>
      <button className="hover:text-text" aria-label="Motion">
        <FilmIcon />
      </button>
      <button className="hover:text-text" aria-label="Notes">
        <NotesIcon />
      </button>
      <button
        onClick={onToggleAnnotations}
        className={annotationsOpen ? 'rounded-standard bg-surface-2 p-1 text-text' : 'hover:text-text'}
        aria-label="Annotations"
      >
        <RouteIcon />
      </button>
      <button className="hover:text-text" aria-label="Personnel">
        <PersonnelIcon />
      </button>
      <button className="hover:text-text" aria-label="Preview">
        <PlayIcon />
      </button>
    </div>
  )
}
