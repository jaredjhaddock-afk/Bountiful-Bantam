import { useState } from 'react'
import { usePlaybook } from '../../state/playbookStore'
import type { Unit } from '../../types/play'
import { CheckIcon, NoIcon } from '../icons'

interface NewPlayModalProps {
  unit: Unit
  defaultFormationId: string
  onClose: () => void
  onCreated: (playId: string) => void
}

export function NewPlayModal({ unit, defaultFormationId, onClose, onCreated }: NewPlayModalProps) {
  const { formationsForUnit, categories, createPlay, plays } = usePlaybook()
  const formations = formationsForUnit(unit)
  const [name, setName] = useState(`Play ${plays.filter((p) => p.unit === unit).length + 1}`)
  const [formationId, setFormationId] = useState(defaultFormationId || formations[0]?.id)
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.unit === unit)?.id ?? 'uncategorized')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const selectedFormation = formations.find((f) => f.id === formationId)

  const handleConfirm = () => {
    const play = createPlay({ name, unit, formationId, categoryId, positionNotes: notes })
    onCreated(play.id)
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-16">
      <div className="w-[720px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">New Play</span>
          <button onClick={handleConfirm} className="text-accent-teal" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4">
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-standard bg-surface-2 px-3 py-2 text-sm outline-none"
            />
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
                <span>Formation</span>
              </div>
              <div className="max-h-40 overflow-auto rounded-standard bg-app-bg">
                {formations.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormationId(f.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      formationId === f.id ? 'bg-surface-2 text-text' : 'text-text hover:bg-hover'
                    }`}
                  >
                    {formationId === f.id && <CheckIcon width={14} height={14} />}
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Categories</div>
              <div className="max-h-32 overflow-auto rounded-standard bg-app-bg">
                {categories
                  .filter((c) => c.unit === unit)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        categoryId === c.id ? 'bg-surface-2 text-text' : 'text-text hover:bg-hover'
                      }`}
                    >
                      {categoryId === c.id && <CheckIcon width={14} height={14} />}
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Optional Play Notes</div>
            <textarea className="mb-4 h-16 w-full rounded-standard bg-app-bg px-3 py-2 text-sm outline-none" />
            <div className="max-h-64 overflow-auto rounded-standard bg-app-bg">
              {(selectedFormation?.players ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-muted text-xs">
                    {p.label}
                  </span>
                  <input
                    placeholder="Position Note"
                    value={notes[p.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="flex-1 bg-transparent text-muted outline-none placeholder:text-muted"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
