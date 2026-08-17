import { useState } from 'react'
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { AppShell } from '../layout/AppShell'
import { FormationEditorView } from './FormationEditorView'
import { FormationsGallery } from './FormationsGallery'
import { NewCategoryModal } from './NewCategoryModal'
import { RouteTreeGallery } from './RouteTreeGallery'
import { PlusIcon } from '../icons'

interface TemplatesViewProps {
  unit: Unit
  nav?: React.ReactNode
  onBack: () => void
}

const UNIT_LABEL: Record<Unit, string> = { offense: 'Offensive', defense: 'Defensive', specialTeams: 'Special Teams' }

export function TemplatesView({ unit, nav, onBack }: TemplatesViewProps) {
  const { categoriesForUnit } = usePlaybook()
  const [tab, setTab] = useState<'formations' | 'categories' | 'routeTree'>('formations')
  const [editingFormationId, setEditingFormationId] = useState<string | 'new' | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)

  if (editingFormationId) {
    return (
      <FormationEditorView
        unit={unit}
        nav={nav}
        formationId={editingFormationId === 'new' ? undefined : editingFormationId}
        onBack={() => setEditingFormationId(null)}
      />
    )
  }

  return (
    <AppShell title={`${UNIT_LABEL[unit]} Templates`} onBack={onBack} nav={nav}>
      <div className="flex bg-panel text-sm font-bold uppercase tracking-wide">
        <button
          onClick={() => setTab('formations')}
          className={`flex-1 py-3 ${tab === 'formations' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Formations
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`flex-1 py-3 ${tab === 'categories' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Categories
        </button>
        {unit === 'offense' && (
          <button
            onClick={() => setTab('routeTree')}
            className={`flex-1 py-3 ${tab === 'routeTree' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
          >
            Route Tree
          </button>
        )}
      </div>
      {tab === 'formations' && (
        <FormationsGallery unit={unit} onNewFormation={() => setEditingFormationId('new')} onEditFormation={(id) => setEditingFormationId(id)} />
      )}
      {tab === 'categories' && (
        <div className="p-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {categoriesForUnit(unit).map((c) => (
              <span key={c.id} className="rounded-standard bg-panel px-3 py-1.5 text-sm text-text">
                {c.name}
              </span>
            ))}
          </div>
          <button
            onClick={() => setAddingCategory(true)}
            className="flex items-center gap-2 rounded-standard border border-dashed border-white/15 px-3 py-2 text-sm text-muted hover:border-accent-teal hover:text-text"
          >
            <PlusIcon width={16} height={16} /> New Category
          </button>
        </div>
      )}
      {tab === 'routeTree' && <RouteTreeGallery />}
      {addingCategory && <NewCategoryModal unit={unit} onClose={() => setAddingCategory(false)} />}
    </AppShell>
  )
}
