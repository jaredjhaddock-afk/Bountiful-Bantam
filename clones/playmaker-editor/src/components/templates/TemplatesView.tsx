import { useState } from 'react'
import { AppShell } from '../layout/AppShell'
import { FormationsGallery } from './FormationsGallery'
import { RouteTreeGallery } from './RouteTreeGallery'

interface TemplatesViewProps {
  onBack: () => void
}

export function TemplatesView({ onBack }: TemplatesViewProps) {
  const [tab, setTab] = useState<'formations' | 'routeTree'>('formations')

  return (
    <AppShell title="Offensive Templates" onBack={onBack}>
      <div className="flex bg-panel text-sm font-bold uppercase tracking-wide">
        <button
          onClick={() => setTab('formations')}
          className={`flex-1 py-3 ${tab === 'formations' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Offensive Formations
        </button>
        <button
          onClick={() => setTab('routeTree')}
          className={`flex-1 py-3 ${tab === 'routeTree' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Route Tree
        </button>
      </div>
      {tab === 'formations' ? <FormationsGallery /> : <RouteTreeGallery />}
    </AppShell>
  )
}
