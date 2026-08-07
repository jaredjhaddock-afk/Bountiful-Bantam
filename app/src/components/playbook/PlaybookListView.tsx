import { useState } from 'react'
import { usePlaybook } from '../../state/playbookStore'
import type { Unit } from '../../types/play'
import { AppShell } from '../layout/AppShell'
import { FilterTabs, type FilterMode } from './FilterTabs'
import { FormationList } from './FormationList'
import { NewPlayModal } from './NewPlayModal'
import { NewPlayTile } from './NewPlayTile'
import { PlayCard } from './PlayCard'
import { UnitTabs } from './UnitTabs'

interface PlaybookListViewProps {
  onOpenPlay: (id: string) => void
  onOpenTemplates: () => void
}

export function PlaybookListView({ onOpenPlay, onOpenTemplates }: PlaybookListViewProps) {
  const { teamName, formationsForUnit, categories, plays } = usePlaybook()
  const [unit, setUnit] = useState<Unit>('offense')
  const [filterMode, setFilterMode] = useState<FilterMode>('formations')
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

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

  return (
    <AppShell title={`${teamName} Playbooks`}>
      <UnitTabs unit={unit} onChange={(u) => (setUnit(u), setActiveFilterId(null))} />
      <div className="flex h-[calc(100%-3rem)]">
        <div className="flex flex-col">
          <FilterTabs mode={filterMode} onChange={setFilterMode} />
          <FormationList
            items={listItems}
            activeId={activeFilterId}
            onSelect={setActiveFilterId}
            editLabel={filterMode === 'formations' ? 'Edit Formations' : 'Edit Categories'}
            onEdit={onOpenTemplates}
          />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-wrap gap-4">
            <NewPlayTile unit={unit} onClick={() => setModalOpen(true)} />
            {visiblePlays.map((p, i) => (
              <PlayCard key={p.id} play={p} index={i + 1} onOpen={onOpenPlay} />
            ))}
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
