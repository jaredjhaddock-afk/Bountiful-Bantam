import { useState } from 'react'
import type { FillStyle, Formation, PlayerRole, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { createDefaultOffensePlayers } from '../../lib/formationDefaults'
import { mirrorFormation } from '../../lib/mirrorFormation'
import { AppShell } from '../layout/AppShell'
import { TrashIcon, MirrorIcon } from '../icons'
import { FormationCanvas } from './FormationCanvas'
import { ColorLabelPanel } from './ColorLabelPanel'
import { MirrorNameModal } from './MirrorNameModal'

interface FormationEditorViewProps {
  unit: Unit
  nav?: React.ReactNode
  formationId?: string
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

const FIELD_WIDTH = 100

export function FormationEditorView({ unit, nav, formationId, onBack }: FormationEditorViewProps) {
  const { createFormation, updateFormation, getFormation } = usePlaybook()
  const existing = formationId ? getFormation(formationId) : undefined
  const isOffensePrePopulated = unit === 'offense'

  const [name, setName] = useState(existing?.name ?? 'New Formation')
  const [players, setPlayers] = useState<Formation['players']>(
    existing?.players ?? (isOffensePrePopulated ? createDefaultOffensePlayers() : []),
  )
  const [armedRole, setArmedRole] = useState<PlayerRole | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelError, setLabelError] = useState<string | null>(null)
  const [mirroring, setMirroring] = useState(false)

  const roleOptions = ROLE_OPTIONS[unit]
  const selectedPlayer = players.find((p) => p.id === selectedId) ?? null

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

  const renameSelected = (newLabel: string) => {
    if (!selectedId) return
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setLabelError(null)
      return
    }
    const duplicate = players.some((p) => p.id !== selectedId && p.label.trim().toLowerCase() === trimmed.toLowerCase())
    if (duplicate) {
      setLabelError(`"${trimmed}" is already used by another player.`)
      return
    }
    setLabelError(null)
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, label: trimmed } : p)))
  }

  const recolorSelected = (color: string) => {
    if (!selectedId) return
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, color } : p)))
  }

  const restyleSelected = (fillStyle: FillStyle) => {
    if (!selectedId) return
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, fillStyle } : p)))
  }

  const handleSave = async () => {
    if (!name.trim() || players.length === 0) return
    setSaving(true)
    setError(null)
    try {
      if (existing) {
        await updateFormation({ ...existing, name: name.trim(), players })
      } else {
        await createFormation({ name: name.trim(), unit, players })
      }
      onBack()
    } catch {
      setError('Could not save this formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleMirrorConfirm = async (mirroredName: string) => {
    setMirroring(false)
    setSaving(true)
    setError(null)
    try {
      await createFormation({ name: mirroredName, unit, players: mirrorFormation(players, FIELD_WIDTH) })
      onBack()
    } catch {
      setError('Could not save the mirrored formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={name} subtitle={unit} onBack={onBack} nav={nav}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-panel px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
        />
        {error && <span className="text-xs text-alert-red">{error}</span>}
        {existing && (
          <button
            onClick={() => setMirroring(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-standard bg-app-bg px-3 py-2 text-xs font-bold uppercase text-muted hover:text-text disabled:opacity-40"
          >
            <MirrorIcon width={16} height={16} /> Mirror
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || players.length === 0}
          className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {!isOffensePrePopulated && (
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
      )}

      <div className="relative" style={{ height: `calc(100% - ${isOffensePrePopulated ? 60 : 116}px)` }}>
        <FormationCanvas
          players={players}
          selectedId={selectedId}
          armed={armedRole !== null}
          onAddPlayer={addPlayer}
          onSelectPlayer={(id) => {
            setSelectedId(id)
            setArmedRole(null)
            setLabelError(null)
          }}
          onMovePlayer={movePlayer}
        />
        {isOffensePrePopulated && selectedPlayer && (
          <ColorLabelPanel
            key={selectedPlayer.id}
            label={selectedPlayer.label}
            color={selectedPlayer.color ?? '#00746b'}
            fillStyle={selectedPlayer.fillStyle ?? 'outline'}
            error={labelError}
            onRename={renameSelected}
            onColorChange={recolorSelected}
            onFillStyleChange={restyleSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
        {mirroring && (
          <MirrorNameModal
            defaultName={`${name} (Mirrored)`}
            onConfirm={handleMirrorConfirm}
            onCancel={() => setMirroring(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
