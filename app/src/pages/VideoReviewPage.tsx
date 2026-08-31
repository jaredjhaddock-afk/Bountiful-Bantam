import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import { ClipLibrary } from '../components/source/ClipLibrary'
import { GamesLibrary } from '../components/source/GamesLibrary'
import { useClips, type Clip } from '../state/clipsStore'
import { useGames } from '../state/gamesStore'
import { useClipBookmarks } from '../state/bookmarksStore'
import { fileFingerprint } from '../lib/bookmarkUtils'
import { gameLabel } from '../lib/gameLabel'
import type { ShareTarget } from '../lib/shareLink'
import type { Stroke, VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
  pendingTarget: ShareTarget | null
  onPendingTargetHandled: () => void
}

function clipToSource(clip: Clip): VideoSource {
  if (clip.sourceType === 'youtube') return { type: 'youtube', url: clip.sourceRef, youtubeId: clip.sourceRef }
  if (clip.sourceType === 'drive') return { type: 'drive', url: clip.sourceRef }
  // 'file' clips are never opened through this path — handleOpenClip below routes them
  // through the file-picker reopen flow instead, since a local file's bytes can never be
  // reconstructed from its stored fingerprint.
  throw new Error('File clips must be reopened via the file picker, not clipToSource')
}

type Mode = 'games' | 'clips' | 'add' | 'player'

export function VideoReviewPage({ nav, pendingTarget, onPendingTargetHandled }: VideoReviewPageProps) {
  const { clips, loading: clipsLoading, createClip, updateClip, findOrCreateFileClip } = useClips()
  const { games, loading: gamesLoading } = useGames()
  const [mode, setMode] = useState<Mode>('games')
  // Meaningful only while mode !== 'games': null means the "Unassigned" bucket.
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [source, setSource] = useState<VideoSource | null>(null)
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const [initialSeekTime, setInitialSeekTime] = useState<number | undefined>(undefined)
  const { bookmarks, createBookmark, updateBookmarkNote, deleteBookmark } = useClipBookmarks(activeClip?.id ?? null)

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null

  const handleOpenGame = (gameId: string | null) => {
    setSelectedGameId(gameId)
    setMode('clips')
  }

  const handleNewSource = (newSource: VideoSource) => {
    setInitialSeekTime(undefined)
    if (newSource.type === 'file') {
      const fingerprint = fileFingerprint(newSource.fileName ?? 'untitled', newSource.fileSize ?? 0)
      const clip = findOrCreateFileClip(fingerprint, newSource.fileName ?? 'Untitled', selectedGameId)
      setActiveClip(clip)
      setSource(newSource)
      setMode('player')
      return
    }
    const ref = newSource.type === 'youtube' ? (newSource.youtubeId ?? newSource.url) : newSource.url
    const clip = createClip({ sourceType: newSource.type, sourceRef: ref, title: newSource.fileName ?? null, gameId: selectedGameId })
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

  // Resolves a share link's target once games and clips have both loaded. A game id
  // that isn't found (wrong team, deleted, stale link) falls back to the normal Games
  // list; a clip id not found within that game falls back to that game's clip list.
  // Either branch calls onPendingTargetHandled so this never re-runs, even though
  // `games`/`clips` keep changing identity as data streams in from Supabase.
  useEffect(() => {
    if (!pendingTarget || gamesLoading || clipsLoading) return
    const game = games.find((g) => g.id === pendingTarget.gameId) ?? null
    if (!game) {
      onPendingTargetHandled()
      return
    }
    setSelectedGameId(game.id)
    setMode('clips')
    if (pendingTarget.clipId) {
      const clip = clips.find((c) => c.id === pendingTarget.clipId && c.gameId === game.id) ?? null
      if (clip) {
        setInitialSeekTime(pendingTarget.timeSeconds ?? undefined)
        if (clip.sourceType === 'file') {
          setPendingFileReopen(clip)
          reopenFileInputRef.current?.click()
        } else {
          setActiveClip(clip)
          setSource(clipToSource(clip))
          setMode('player')
        }
      }
    }
    onPendingTargetHandled()
  }, [pendingTarget, gamesLoading, clipsLoading, games, clips, onPendingTargetHandled])

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
    setInitialSeekTime(undefined)
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

  // 'clips' backs out to the games list; 'add' and 'player' both back out to the clip
  // list they were opened from (the game stays selected).
  const handleBack = () => {
    flushPendingClipUpdate()
    if (mode === 'clips') {
      setMode('games')
      setSelectedGameId(null)
      return
    }
    setSource(null)
    setActiveClip(null)
    setMode('clips')
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

  const title = mode === 'games' ? 'Video Review' : selectedGame ? gameLabel(selectedGame) : 'Unassigned'

  return (
    <AppShell title={title} nav={nav} onBack={mode !== 'games' ? handleBack : undefined}>
      <input ref={reopenFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleReopenFileSelected} />
      {mode === 'games' && <GamesLibrary onOpenGame={handleOpenGame} />}
      {mode === 'clips' && <ClipLibrary gameId={selectedGameId} onOpenClip={handleOpenClip} onAddNew={() => setMode('add')} />}
      {mode === 'add' && <VideoSourceModal onSelect={handleNewSource} />}
      {mode === 'player' && source && (
        <VideoPlayerPage
          // Keyed on the clip so reopening a different clip remounts the player fresh
          // instead of carrying over the previous clip's in/out points and drawing strokes.
          key={activeClip?.id ?? 'local-file'}
          source={source}
          gameId={selectedGameId}
          clipId={activeClip?.id ?? ''}
          initialSeekTime={initialSeekTime}
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
