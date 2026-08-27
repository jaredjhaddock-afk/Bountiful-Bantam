import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Formation, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { reorderIds } from '../../lib/listOrdering'
import { FieldCanvas } from '../editor/FieldCanvas'
import { GripIcon, TrashIcon } from '../icons'
import { DeleteConfirmModal } from '../playbook/DeleteConfirmModal'

interface FormationsGalleryProps {
  unit: Unit
  onNewFormation: () => void
  onEditFormation: (formationId: string) => void
}

function SortableFormationCard({
  formation,
  onEditFormation,
  onDeleteRequest,
}: {
  formation: Formation
  onEditFormation: (id: string) => void
  onDeleteRequest: (formation: Formation) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: formation.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
        <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-muted hover:text-text">
          <GripIcon width={14} height={14} />
        </button>
        <button onClick={() => onDeleteRequest(formation)} aria-label="Delete formation" className="text-muted hover:text-alert-red">
          <TrashIcon width={14} height={14} />
        </button>
      </div>
      <button onClick={() => onEditFormation(formation.id)} className="flex flex-1 flex-col overflow-hidden text-left hover:opacity-90">
        <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
          <FieldCanvas players={formation.players.map((p) => ({ ...p, route: [] }))} readOnly />
        </div>
        <div className="px-2 pb-2 text-sm">{formation.name}</div>
      </button>
    </div>
  )
}

export function FormationsGallery({ unit, onNewFormation, onEditFormation }: FormationsGalleryProps) {
  const { formationsForUnit, deleteFormation, reorderFormations } = usePlaybook()
  const formations = formationsForUnit(unit)
  const [deleting, setDeleting] = useState<Formation | null>(null)
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = formations.map((f) => f.id)
    const newIndex = ids.indexOf(String(over.id))
    reorderFormations(unit, reorderIds(ids, String(active.id), newIndex))
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      const result = await deleteFormation(deleting.id)
      if (result.blocked) {
        setBlockedNames(result.playNames)
      } else {
        setDeleting(null)
      }
    } catch {
      setDeleteError('Could not delete this formation. Try again.')
    }
  }

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <button
        onClick={onNewFormation}
        className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
      >
        + New Formation
      </button>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={formations.map((f) => f.id)} strategy={rectSortingStrategy}>
          {formations.map((f) => (
            <SortableFormationCard
              key={f.id}
              formation={f}
              onEditFormation={onEditFormation}
              onDeleteRequest={(formation) => {
                setDeleting(formation)
                setBlockedNames(null)
                setDeleteError(null)
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      {deleting && (
        <DeleteConfirmModal
          itemName={deleting.name}
          blockedByNames={blockedNames ?? undefined}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null)
            setBlockedNames(null)
            setDeleteError(null)
          }}
        />
      )}
    </div>
  )
}
