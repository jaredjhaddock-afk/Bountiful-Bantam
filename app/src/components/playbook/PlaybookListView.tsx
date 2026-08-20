import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { usePlaybook } from '../../state/playbookStore'
import type { Play, Unit } from '../../types/play'
import { reorderIds } from '../../lib/listOrdering'
import { AppShell } from '../layout/AppShell'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { FilterTabs, type FilterMode } from './FilterTabs'
import { FormationList } from './FormationList'
import { NewPlayModal } from './NewPlayModal'
import { NewPlayTile } from './NewPlayTile'
import { PlayCard } from './PlayCard'
import { UnitTabs } from './UnitTabs'

interface PlaybookListViewProps {
  nav?: React.ReactNode
  onOpenPlay: (id: string) => void
  onOpenTemplates: (unit: Unit) => void
}

export function PlaybookListView({ nav, onOpenPlay, onOpenTemplates }: PlaybookListViewProps) {
  const { teamName, formationsForUnit, categories, plays, reorderPlays, deletePlay } = usePlaybook()
  const [unit, setUnit] = useState<Unit>('offense')
  const [filterMode, setFilterMode] = useState<FilterMode>('formations')
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<Play | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const formations = formationsForUnit(unit)
  const unitCategories = categories.filter((c) => c.unit === unit)
  const unitPlays = plays.filter((p) => p.unit === unit)

  const listItems =
    filterMode === 'formations'
      ? formations.map((f) => ({ id: f.id, name: f.name, count: unitPlays.filter((p) => p.formationId === f.id).length }))
      : unitCategories.map((c) => ({ id: c.id, name: c.name, count: unitPlays.filter((p) => p.categoryId === c.id).length }))

  const visiblePlays = activeFilterId
    ? unitPlays.filter((p) => (filterMode === 'formations' ? p.formationId === activeFilterId : p.categoryId === activeFilterId))
    : unitPlays

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = unitPlays.map((p) => p.id)
    const newIndex = ids.indexOf(String(over.id))
    reorderPlays(unit, reorderIds(ids, String(active.id), newIndex))
  }

  return (
    <AppShell title={`${teamName} Playbooks`} nav={nav}>
      <UnitTabs unit={unit} onChange={(u) => (setUnit(u), setActiveFilterId(null))} />
      <div className="flex h-[calc(100%-3rem)]">
        <div className="flex flex-col">
          <FilterTabs mode={filterMode} onChange={setFilterMode} />
          <FormationList
            items={listItems}
            activeId={activeFilterId}
            onSelect={setActiveFilterId}
            editLabel={filterMode === 'formations' ? 'Edit Formations' : 'Edit Categories'}
            onEdit={() => onOpenTemplates(unit)}
          />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-wrap gap-4">
            <NewPlayTile unit={unit} onClick={() => setModalOpen(true)} />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visiblePlays.map((p) => p.id)} strategy={rectSortingStrategy}>
                {visiblePlays.map((p) => (
                  <PlayCard
                    key={p.id}
                    play={p}
                    onOpen={onOpenPlay}
                    sortable={!activeFilterId}
                    onDeleteRequest={(play) => {
                      setDeleting(play)
                      setDeleteError(null)
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {deleting && (
              <DeleteConfirmModal
                itemName={deleting.name}
                error={deleteError}
                onConfirm={async () => {
                  try {
                    await deletePlay(deleting.id)
                    setDeleting(null)
                  } catch {
                    setDeleteError('Could not delete this play. Try again.')
                  }
                }}
                onCancel={() => {
                  setDeleting(null)
                  setDeleteError(null)
                }}
              />
            )}
          </div>
        </div>
      </div>
      {modalOpen && (
        <NewPlayModal
          unit={unit}
          defaultFormationId={activeFilterId && filterMode === 'formations' ? activeFilterId : formations[0]?.id}
          onClose={() => setModalOpen(false)}
          onCreated={(id) => {
            setModalOpen(false)
            onOpenPlay(id)
          }}
        />
      )}
    </AppShell>
  )
}
