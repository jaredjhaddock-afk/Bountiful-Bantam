export type FilterMode = 'formations' | 'categories'

interface FilterTabsProps {
  mode: FilterMode
  onChange: (mode: FilterMode) => void
}

export function FilterTabs({ mode, onChange }: FilterTabsProps) {
  return (
    <div className="flex bg-panel text-xs font-bold uppercase tracking-wide">
      {(['formations', 'categories'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex-1 py-2 ${mode === m ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
