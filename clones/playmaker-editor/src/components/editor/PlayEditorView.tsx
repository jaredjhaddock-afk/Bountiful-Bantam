import { useMemo, useState } from 'react'
import { usePlaybook } from '../../state/playbookStore'
import type { AnnotationKind, RouteStyle } from '../../types/play'
import { AppShell } from '../layout/AppShell'
import { AnnotationsPanel } from './AnnotationsPanel'
import { EditorToolbar } from './EditorToolbar'
import { FieldCanvas } from './FieldCanvas'
import { RouteToolBar } from './RouteToolBar'

interface PlayEditorViewProps {
  playId: string
  onBack: () => void
}

export function PlayEditorView({ playId, onBack }: PlayEditorViewProps) {
  const { plays, getFormation, updatePlay } = usePlaybook()
  const play = plays.find((p) => p.id === playId)

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [armedStyle, setArmedStyle] = useState<RouteStyle | null>(null)
  const [locked, setLocked] = useState(true)
  const [annotationsOpen, setAnnotationsOpen] = useState(false)
  const [armedAnnotation, setArmedAnnotation] = useState<AnnotationKind | null>(null)

  const formation = play ? getFormation(play.formationId) : undefined

  if (!play) return null

  const selectPlayer = (id: string) => {
    setSelectedPlayerId(id)
    setArmedStyle(null)
    setArmedAnnotation(null)
  }

  const armStyle = (style: RouteStyle) => setArmedStyle(style)

  const armAnnotation = (kind: AnnotationKind) => {
    setSelectedPlayerId(null)
    setArmedAnnotation(kind)
  }

  const handleFieldClick = (point: { x: number; y: number }) => {
    if (armedAnnotation) {
      updatePlay({
        ...play,
        annotations: [...play.annotations, { id: crypto.randomUUID(), kind: armedAnnotation, ...point }],
      })
      return
    }
    if (!selectedPlayerId || !armedStyle) return
    updatePlay({
      ...play,
      players: play.players.map((p) =>
        p.id === selectedPlayerId ? { ...p, route: [...p.route, point], routeStyle: armedStyle } : p,
      ),
    })
  }

  const deleteRoute = () => {
    if (!selectedPlayerId) return
    updatePlay({
      ...play,
      players: play.players.map((p) => (p.id === selectedPlayerId ? { ...p, route: [], routeStyle: undefined } : p)),
    })
  }

  const confirmSelection = () => {
    setSelectedPlayerId(null)
    setArmedStyle(null)
  }

  return (
    <AppShell title={play.name} subtitle={formation?.name} onBack={onBack}>
      <div className="relative flex h-full flex-col">
        <EditorToolbar
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
          annotationsOpen={annotationsOpen}
          onToggleAnnotations={() => setAnnotationsOpen((v) => !v)}
        />
        {annotationsOpen && (
          <AnnotationsPanel
            armed={armedAnnotation}
            onArm={armAnnotation}
            onClose={() => {
              setAnnotationsOpen(false)
              setArmedAnnotation(null)
            }}
          />
        )}
        <div className="relative flex-1">
          <FieldCanvas
            players={play.players}
            annotations={play.annotations}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={selectPlayer}
            onFieldClick={handleFieldClick}
          />
          {selectedPlayerId && (
            <RouteToolBar armedStyle={armedStyle} onArmStyle={armStyle} onDelete={deleteRoute} onConfirm={confirmSelection} />
          )}
        </div>
      </div>
    </AppShell>
  )
}

export function usePlayThumbnailProps(playId: string) {
  const { plays } = usePlaybook()
  return useMemo(() => plays.find((p) => p.id === playId), [plays, playId])
}
