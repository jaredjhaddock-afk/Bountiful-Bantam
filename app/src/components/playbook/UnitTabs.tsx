import type { Unit } from '../../types/play'

const TABS: { unit: Unit; label: string }[] = [
  { unit: 'offense', label: '○' },
  { unit: 'defense', label: '✕' },
  { unit: 'specialTeams', label: '◇' },
]

interface UnitTabsProps {
  unit: Unit
  onChange: (unit: Unit) => void
}

export function UnitTabs({ unit, onChange }: UnitTabsProps) {
  return (
    <div className="flex gap-1 border-b border-white/10 bg-app-bg px-2 pt-2">
      {TABS.map((t) => (
        <button
          key={t.unit}
          onClick={() => onChange(t.unit)}
          className={`flex h-9 w-9 items-center justify-center rounded-standard text-lg ${
            unit === t.unit ? 'bg-panel text-text' : 'text-muted hover:bg-hover'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
