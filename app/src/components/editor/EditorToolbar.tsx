import { FilmIcon, InfoIcon, LockIcon, NotesIcon, PersonnelIcon, PlayIcon, RouteIcon } from '../icons'

interface EditorToolbarProps {
  locked: boolean
  onToggleLock: () => void
  annotationsOpen: boolean
  onToggleAnnotations: () => void
}

export function EditorToolbar({ locked, onToggleLock, annotationsOpen, onToggleAnnotations }: EditorToolbarProps) {
  const iconProps = { width: 22, height: 22, strokeWidth: 1.8 }
  return (
    <div className="flex items-center justify-center gap-6 border-b border-white/10 bg-app-bg py-2 text-[#9aa4b0]">
      <button className="hover:text-text" aria-label="Info">
        <InfoIcon {...iconProps} />
      </button>
      <button
        onClick={onToggleLock}
        className={locked ? 'rounded-standard bg-surface-2 p-1 text-text' : 'hover:text-text'}
        aria-label="Lock"
      >
        <LockIcon {...iconProps} />
      </button>
      <button className="hover:text-text" aria-label="Motion">
        <FilmIcon {...iconProps} />
      </button>
      <button className="hover:text-text" aria-label="Notes">
        <NotesIcon {...iconProps} />
      </button>
      <button
        onClick={onToggleAnnotations}
        className={annotationsOpen ? 'rounded-standard bg-surface-2 p-1 text-text' : 'hover:text-text'}
        aria-label="Annotations"
      >
        <RouteIcon {...iconProps} />
      </button>
      <button className="hover:text-text" aria-label="Personnel">
        <PersonnelIcon {...iconProps} />
      </button>
      <button className="hover:text-text" aria-label="Preview">
        <PlayIcon {...iconProps} />
      </button>
    </div>
  )
}
