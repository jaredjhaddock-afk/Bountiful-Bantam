import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Kept in sync with `activeClip` so handleClipStateChange can read the latest clip without
  // depending on `activeClip`'s value (which would make the callback's identity change on every
  // clip switch — see below).
  const activeClipRef = useRef<Clip | null>(null)
  useEffect(() => {
    activeClipRef.current = activeClip
  }, [activeClip])

  // Trim-handle drags and drawing strokes fire onStateChange continuously (on every pointer
  // move), which would otherwise mean a real Supabase `update` per pointer-move — dozens of
  // concurrent, unordered requests for one gesture, risking a stale intermediate state landing
  // last. So the actual persistence is debounced: the pending clip is stashed in
  // `pendingUpdateRef` and only written after edits pause for ~600ms. `activeClip` itself (and
  // the ref that mirrors it) still update immediately so the UI stays responsive and any
  // subsequent debounced write is computed from the latest state.
  const persistTimeoutRef = useRef<number | null>(null)
  const pendingUpdateRef = useRef<Clip | null>(null)

  const flushPendingClipUpdate = useCallback(() => {
    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current)
      persistTimeoutRef.current = null
    }
    if (pendingUpdateRef.current) {
      updateClip(pendingUpdateRef.current)
      pendingUpdateRef.current = null
    }
  }, [updateClip])

  // Flush on unmount too (e.g. the user switches to the Playbook tab mid-edit), not just on
  // explicit back-navigation.
  useEffect(() => flushPendingClipUpdate, [flushPendingClipUpdate])

  const handleBack = () => {
    flushPendingClipUpdate()
    setSource(null)
    setActiveClip(null)
    setMode('library')
  }

  // Stable across re-renders (identity only changes if `updateClip` itself changes, which it
  // never does after mount). That matters here: VideoPlayerPage's persistence effect lists
  // `onStateChange` as a dependency, so a fresh identity each render would re-fire the effect,
  // call updateClip, change the clips array, re-render this component, and produce a fresh
  // identity again — an infinite loop of Supabase writes every time a saved clip is open.
  //
  // `setActiveClip` and the debounced `updateClip` are called as separate top-level statements
  // rather than nesting the Supabase call inside the `setActiveClip` updater function — React
  // StrictMode double-invokes updater functions in dev to surface exactly this kind of impurity,
  // which would have fired the Supabase write twice per real state change.
  const handleClipStateChange = useCallback(
    (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => {
      const current = activeClipRef.current
      if (!current) return
      const updated = { ...current, ...state }
      setActiveClip(updated)
      pendingUpdateRef.current = updated
      if (persistTimeoutRef.current !== null) window.clearTimeout(persistTimeoutRef.current)
      persistTimeoutRef.current = window.setTimeout(() => {
        persistTimeoutRef.current = null
        if (pendingUpdateRef.current) {
          updateClip(pendingUpdateRef.current)
          pendingUpdateRef.current = null
        }
      }, 600)
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
