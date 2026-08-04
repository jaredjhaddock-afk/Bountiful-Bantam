import { useState } from 'react'
import { PlayEditorView } from './components/editor/PlayEditorView'
import { PlaybookListView } from './components/playbook/PlaybookListView'
import { TemplatesView } from './components/templates/TemplatesView'

type View = { name: 'list' } | { name: 'editor'; playId: string } | { name: 'templates' }

function App() {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'editor') {
    return <PlayEditorView playId={view.playId} onBack={() => setView({ name: 'list' })} />
  }
  if (view.name === 'templates') {
    return <TemplatesView onBack={() => setView({ name: 'list' })} />
  }
  return (
    <PlaybookListView
      onOpenPlay={(playId) => setView({ name: 'editor', playId })}
      onOpenTemplates={() => setView({ name: 'templates' })}
    />
  )
}

export default App
