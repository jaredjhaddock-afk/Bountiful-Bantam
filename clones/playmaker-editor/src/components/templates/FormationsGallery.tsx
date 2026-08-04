import { usePlaybook } from '../../state/playbookStore'
import { FieldCanvas } from '../editor/FieldCanvas'

export function FormationsGallery() {
  const { formationsForUnit } = usePlaybook()
  const formations = formationsForUnit('offense')

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <button className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text">
        + New Offensive Formation
      </button>
      {formations.map((f) => (
        <div key={f.id} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
          <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
            <FieldCanvas players={f.players.map((p) => ({ ...p, route: [] }))} readOnly />
          </div>
          <div className="px-2 pb-2 text-sm">{f.name}</div>
        </div>
      ))}
    </div>
  )
}
