import { PlusIcon } from '../icons'

interface NewPlayTileProps {
  unit: 'offense' | 'defense' | 'specialTeams'
  onClick: () => void
}

const LABEL: Record<NewPlayTileProps['unit'], string> = {
  offense: 'New Offensive Play',
  defense: 'New Defensive Play',
  specialTeams: 'New Special Teams Play',
}

export function NewPlayTile({ unit, onClick }: NewPlayTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-44 w-56 flex-col items-center justify-center gap-3 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
    >
      <PlusIcon width={28} height={28} />
      <span className="text-xs font-bold uppercase tracking-wide">{LABEL[unit]}</span>
    </button>
  )
}
