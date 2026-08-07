import type { Play } from '../../types/play'
import { FieldCanvas } from '../editor/FieldCanvas'

interface PlayCardProps {
  play: Play
  index: number
  onOpen: (id: string) => void
}

export function PlayCard({ play, index, onOpen }: PlayCardProps) {
  return (
    <button
      onClick={() => onOpen(play.id)}
      className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg text-left hover:border-accent-teal"
    >
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
        <span>{index}</span>
        <span>ⓘ</span>
      </div>
      <div className="flex-1">
        <FieldCanvas players={play.players} annotations={play.annotations} readOnly />
      </div>
      <div className="px-2 pb-2 text-sm">{play.name}</div>
    </button>
  )
}
