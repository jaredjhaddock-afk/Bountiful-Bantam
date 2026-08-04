interface ListItem {
  id: string
  name: string
  count: number
}

interface FormationListProps {
  items: ListItem[]
  activeId: string | null
  onSelect: (id: string | null) => void
  editLabel: string
  onEdit: () => void
}

export function FormationList({ items, activeId, onSelect, editLabel, onEdit }: FormationListProps) {
  return (
    <div className="flex h-full w-52 flex-col border-r border-white/10 bg-app-bg">
      <div className="flex-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(activeId === item.id ? null : item.id)}
            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
              activeId === item.id ? 'bg-panel text-text' : 'text-text hover:bg-hover'
            }`}
          >
            <span>{item.name}</span>
            <span className="text-muted">{item.count}</span>
          </button>
        ))}
      </div>
      <button onClick={onEdit} className="border-t border-white/10 px-4 py-3 text-left text-sm text-text hover:bg-hover">
        ✎ {editLabel}
      </button>
    </div>
  )
}
