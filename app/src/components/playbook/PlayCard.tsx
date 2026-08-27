import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Play } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { isNumberTaken } from '../../lib/listOrdering'
import { FieldCanvas } from '../editor/FieldCanvas'
import { GripIcon, TrashIcon } from '../icons'

interface PlayCardProps {
  play: Play
  onOpen: (id: string) => void
  sortable: boolean
  onDeleteRequest: (play: Play) => void
}

export function PlayCard({ play, onOpen, sortable, onDeleteRequest }: PlayCardProps) {
  const { plays, updatePlay } = usePlaybook()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: play.id, disabled: !sortable })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const [editingNumber, setEditingNumber] = useState(false)
  const [numberDraft, setNumberDraft] = useState(String(play.number))
  const [numberError, setNumberError] = useState<string | null>(null)
  const committedRef = useRef(false)

  const commitNumber = () => {
    if (committedRef.current) return
    const parsed = Number(numberDraft)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setNumberError('Enter a whole number greater than 0.')
      return
    }
    const unitPlays = plays.filter((p) => p.unit === play.unit)
    if (isNumberTaken(unitPlays, parsed, play.id)) {
      setNumberError(`#${parsed} is already used by another play.`)
      return
    }
    committedRef.current = true
    setNumberError(null)
    setEditingNumber(false)
    if (parsed !== play.number) updatePlay({ ...play, number: parsed })
  }

  return (
    <div ref={setNodeRef} style={style} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
        {sortable && (
          <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-muted hover:text-text">
            <GripIcon width={14} height={14} />
          </button>
        )}
        {editingNumber ? (
          <input
            autoFocus
            value={numberDraft}
            onChange={(e) => setNumberDraft(e.target.value)}
            onBlur={commitNumber}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber()}
            className="w-10 rounded bg-surface-2 px-1 text-center text-text outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setNumberDraft(String(play.number))
              setNumberError(null)
              committedRef.current = false
              setEditingNumber(true)
            }}
            aria-label="Edit play number"
            className="rounded bg-accent-teal px-1.5 py-0.5 font-bold text-white"
          >
            #{play.number}
          </button>
        )}
        <span>ⓘ</span>
        <button onClick={() => onDeleteRequest(play)} aria-label="Delete play" className="text-muted hover:text-alert-red">
          <TrashIcon width={14} height={14} />
        </button>
      </div>
      {numberError && <p className="px-2 text-[10px] text-alert-red">{numberError}</p>}
      <button onClick={() => onOpen(play.id)} className="flex flex-1 flex-col overflow-hidden text-left hover:opacity-90">
        <div className="flex-1">
          <FieldCanvas players={play.players} annotations={play.annotations} readOnly />
        </div>
        <div className="px-2 pb-2 text-sm">{play.name}</div>
      </button>
    </div>
  )
}
