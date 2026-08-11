import { useCallback, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import { ClipLibrary } from '../components/source/ClipLibrary'
import { useClips, type Clip } from '../state/clipsStore'
import type { Stroke, VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
}

function clipToSource(clip: Clip): VideoSource {
  if (clip.sourceType === 'youtube') return { type: 'youtube', url: clip.sourceRef, youtubeId: clip.sourceRef }
  return { type: 'drive', url: clip.sourceRef }
}

type Mode = 'library' | 'add' | 'player'

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const { createClip, updateClip } = useClips()
  const [mode, setMode] = useState<Mode>('library')
  const [source, setSource] = useState<VideoSource | null>(null)
  const [activeClip, setActiveClip] = useState<Clip | null>(null)

  const handleNewSource = (newSource: VideoSource) => {
    if (newSource.type === 'file') {
      // Local files can't be referenced from Supabase (the bytes never leave the browser),
      // so they're never saved to the clip library — just play them directly.
      setActiveClip(null)
      setSource(newSource)
      setMode('player')
      return
    }
    const ref = newSource.type === 'youtube' ? (newSource.youtubeId ?? newSource.url) : newSource.url
    const clip = createClip({ sourceType: newSource.type, sourceRef: ref, title: newSource.fileName ?? null })
    setActiveClip(clip)
    setSource(newSource)
    setMode('player')
  }

  const handleOpenClip = (clip: Clip) => {
    setActiveClip(clip)
    setSource(clipToSource(clip))
    setMode('player')
  }

  const handleBack = () => {
    setSource(null)
    setActiveClip(null)
    setMode('library')
  }

  // Stable across re-renders (identity only changes if `updateClip` itself changes, which it
  // never does after mount). Reads the latest clip via the functional setActiveClip form rather
  // than closing over `activeClip` directly, so this can't turn into a fresh function on every
  // render. That matters here: VideoPlayerPage's persistence effect lists `onStateChange` as a
  // dependency, so a fresh identity each render would re-fire the effect, call updateClip, change
  // the clips array, re-render this component, and produce a fresh identity again — an infinite
  // loop of Supabase writes every time a saved clip is open.
  const handleClipStateChange = useCallback(
    (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => {
      setActiveClip((current) => {
        if (!current) return current
        const updated = { ...current, ...state }
        updateClip(updated)
        return updated
      })
    },
    [updateClip],
  )

  return (
    <AppShell title="Video Review" nav={nav} onBack={mode !== 'library' ? handleBack : undefined}>
      {mode === 'library' && <ClipLibrary onOpenClip={handleOpenClip} onAddNew={() => setMode('add')} />}
      {mode === 'add' && <VideoSourceModal onSelect={handleNewSource} />}
      {mode === 'player' && source && (
        <VideoPlayerPage
          source={source}
          initialTrim={activeClip?.inPoint != null && activeClip?.outPoint != null ? { inPoint: activeClip.inPoint, outPoint: activeClip.outPoint } : undefined}
          initialStrokes={activeClip?.drawingStrokes}
          onStateChange={activeClip ? handleClipStateChange : undefined}
        />
      )}
    </AppShell>
  )
}
