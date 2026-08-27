import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import { ClipLibrary } from '../components/source/ClipLibrary'
import { useClips, type Clip } from '../state/clipsStore'
import { useClipBookmarks } from '../state/bookmarksStore'
import { fileFingerprint } from '../lib/bookmarkUtils'
import type { Stroke, VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
}

function clipToSource(clip: Clip): VideoSource {
  if (clip.sourceType === 'youtube') return { type: 'youtube', url: clip.sourceRef, youtubeId: clip.sourceRef }
  if (clip.sourceType === 'drive') return { type: 'drive', url: clip.sourceRef }
  // 'file' clips are never opened through this path — handleOpenClip below routes them
  // through the file-picker reopen flow instead, since a local file's bytes can never be
  // reconstructed from its stored fingerprint.
  throw new Error('File clips must be reopened via the file picker, not clipToSource')
}

type Mode = 'library' | 'add' | 'player'

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const { createClip, updateClip, findOrCreateFileClip } = useClips()
  const [mode, setMode] = useState<Mode>('library')
  const [source, setSource] = useState<VideoSource | null>(null)
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const { bookmarks, createBookmark, updateBookmarkNote, deleteBookmark } = useClipBookmarks(activeClip?.id ?? null)

  const handleNewSource = (newSource: VideoSource) => {
    if (newSource.type === 'file') {
      const fingerprint = fileFingerprint(newSource.fileName ?? 'untitled', newSource.fileSize ?? 0)
      const clip = findOrCreateFileClip(fingerprint, newSource.fileName ?? 'Untitled')
      setActiveClip(clip)
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

  // Reopening a local-file clip from the library can't play it directly (the browser
  // never retains a reference to the actual file bytes) — it prompts the native file
  // picker instead, and whatever gets picked plays under this clip's existing identity
  // (and bookmarks) directly, with no re-matching against the fingerprint.
  const reopenFileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFileReopen, setPendingFileReopen] = useState<Clip | null>(null)

  const handleReopenFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !pendingFileReopen) return
    setActiveClip(pendingFileReopen)
    setSource({ type: 'file', url: URL.createObjectURL(file), fileName: file.name, fileSize: file.size })
    setPendingFileReopen(null)
    setMode('player')
  }

  const handleOpenClip = (clip: Clip) => {
    flushPendingClipUpdate()
    if (clip.sourceType === 'file') {
      setPendingFileReopen(clip)
      reopenFileInputRef.current?.click()
      return
    }
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
      <input ref={reopenFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleReopenFileSelected} />
      {mode === 'library' && <ClipLibrary onOpenClip={handleOpenClip} onAddNew={() => setMode('add')} />}
      {mode === 'add' && <VideoSourceModal onSelect={handleNewSource} />}
      {mode === 'player' && source && (
        <VideoPlayerPage
          // Keyed on the clip so reopening a different clip remounts the player fresh
          // instead of carrying over the previous clip's in/out points and drawing strokes.
          key={activeClip?.id ?? 'local-file'}
          source={source}
          initialTrim={activeClip?.inPoint != null && activeClip?.outPoint != null ? { inPoint: activeClip.inPoint, outPoint: activeClip.outPoint } : undefined}
          initialStrokes={activeClip?.drawingStrokes}
          onStateChange={activeClip ? handleClipStateChange : undefined}
          bookmarks={bookmarks}
          onCreateBookmark={createBookmark}
          onUpdateBookmarkNote={updateBookmarkNote}
          onDeleteBookmark={deleteBookmark}
        />
      )}
    </AppShell>
  )
}
