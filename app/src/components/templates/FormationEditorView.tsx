import { useState } from 'react'
import type { Formation, PlayerRole, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { AppShell } from '../layout/AppShell'
import { TrashIcon } from '../icons'
import { FormationCanvas } from './FormationCanvas'

interface FormationEditorViewProps {
  unit: Unit
  nav?: React.ReactNode
  onBack: () => void
}

const ROLE_OPTIONS: Record<Unit, { role: PlayerRole; label: string; prefix: string }[]> = {
  offense: [
    { role: 'qb', label: 'QB', prefix: 'QB' },
    { role: 'skill', label: 'Skill', prefix: 'S' },
    { role: 'lineman', label: 'Lineman', prefix: 'L' },
  ],
  defense: [{ role: 'defense', label: 'Defense', prefix: 'D' }],
  specialTeams: [{ role: 'specialTeams', label: 'Special Teams', prefix: 'ST' }],
}

export function FormationEditorView({ unit, nav, onBack }: FormationEditorViewProps) {
  const { createFormation } = usePlaybook()
  const [name, setName] = useState('New Formation')
  const [players, setPlayers] = useState<Formation['players']>([])
  const [armedRole, setArmedRole] = useState<PlayerRole | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions = ROLE_OPTIONS[unit]

  const addPlayer = (point: { x: number; y: number }) => {
    if (!armedRole) return
    const opt = roleOptions.find((r) => r.role === armedRole)!
    const count = players.filter((p) => p.role === armedRole).length
    setPlayers((prev) => [...prev, { id: crypto.randomUUID(), label: `${opt.prefix}${count + 1}`, role: armedRole, x: point.x, y: point.y }])
  }

  const movePlayer = (id: string, point: { x: number; y: number }) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, x: point.x, y: point.y } : p)))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setPlayers((prev) => prev.filter((p) => p.id !== selectedId))
    setSelectedId(null)
  }

  const handleSave = async () => {
    if (!name.trim() || players.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await createFormation({ name: name.trim(), unit, players })
      onBack()
    } catch {
      setError('Could not save this formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="New Formation" subtitle={unit} onBack={onBack} nav={nav}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-panel px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
        />
        {error && <span className="text-xs text-alert-red">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || players.length === 0}
          className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 border-b border-white/10 bg-panel px-4 py-2">
        {roleOptions.map((opt) => (
          <button
            key={opt.role}
            onClick={() => {
              setArmedRole(opt.role)
              setSelectedId(null)
            }}
            className={`rounded-standard px-3 py-1.5 text-xs font-bold uppercase ${
              armedRole === opt.role ? 'bg-accent-teal text-white' : 'bg-app-bg text-muted hover:text-text'
            }`}
          >
            + {opt.label}
          </button>
        ))}
        {selectedId && (
          <button onClick={deleteSelected} className="ml-2 rounded-standard p-1.5 text-alert-red hover:bg-hover" aria-label="Delete player">
            <TrashIcon width={16} height={16} />
          </button>
        )}
      </div>
      <div className="relative" style={{ height: 'calc(100% - 116px)' }}>
        <FormationCanvas
          players={players}
          selectedId={selectedId}
          armed={armedRole !== null}
          onAddPlayer={addPlayer}
          onSelectPlayer={(id) => {
            setSelectedId(id)
            setArmedRole(null)
          }}
          onMovePlayer={movePlayer}
        />
      </div>
    </AppShell>
  )
}
