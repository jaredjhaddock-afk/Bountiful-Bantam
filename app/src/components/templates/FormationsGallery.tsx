import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { FieldCanvas } from '../editor/FieldCanvas'

interface FormationsGalleryProps {
  unit: Unit
  onNewFormation: () => void
  onEditFormation: (formationId: string) => void
}

export function FormationsGallery({ unit, onNewFormation, onEditFormation }: FormationsGalleryProps) {
  const { formationsForUnit } = usePlaybook()
  const formations = formationsForUnit(unit)

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <button
        onClick={onNewFormation}
        className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
      >
        + New Formation
      </button>
      {formations.map((f) => (
        <button
          key={f.id}
          onClick={() => onEditFormation(f.id)}
          className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg text-left hover:border-accent-teal"
        >
          <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
            <FieldCanvas players={f.players.map((p) => ({ ...p, route: [] }))} readOnly />
          </div>
          <div className="px-2 pb-2 text-sm">{f.name}</div>
        </button>
      ))}
    </div>
  )
}
