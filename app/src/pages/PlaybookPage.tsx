import { useState } from 'react'
import { PlayEditorView } from '../components/editor/PlayEditorView'
import { PlaybookListView } from '../components/playbook/PlaybookListView'
import { TemplatesView } from '../components/templates/TemplatesView'

type View = { name: 'list' } | { name: 'editor'; playId: string } | { name: 'templates' }

interface PlaybookPageProps {
  nav: React.ReactNode
}

export function PlaybookPage({ nav }: PlaybookPageProps) {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'editor') {
    return <PlayEditorView nav={nav} playId={view.playId} onBack={() => setView({ name: 'list' })} />
  }
  if (view.name === 'templates') {
    return <TemplatesView nav={nav} onBack={() => setView({ name: 'list' })} />
  }
  return (
    <PlaybookListView
      nav={nav}
      onOpenPlay={(playId) => setView({ name: 'editor', playId })}
      onOpenTemplates={() => setView({ name: 'templates' })}
    />
  )
}
