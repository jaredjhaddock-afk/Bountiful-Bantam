import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaController, Stroke, VideoSource } from '../../types/video'
import type { Bookmark } from '../../state/bookmarksStore'
import { useHoldScrub } from '../../lib/useHoldScrub'
import { findAdjacentBookmark } from '../../lib/bookmarkUtils'
import { ControlBar } from './ControlBar'
import { BookmarksDrawer } from './BookmarksDrawer'
import { DrawingCanvas } from './DrawingCanvas'
import { ScrubBar } from './ScrubBar'
import { VideoStage } from './VideoStage'
import { DeleteConfirmModal } from '../playbook/DeleteConfirmModal'

interface VideoPlayerPageProps {
  source: VideoSource
  gameId: string | null
  clipId: string
  initialTrim?: { inPoint: number; outPoint: number }
  initialSeekTime?: number
  initialStrokes?: Stroke[]
  onStateChange?: (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => void
  bookmarks: Bookmark[]
  onCreateBookmark: (timeSeconds: number) => Bookmark
  onUpdateBookmarkNote: (id: string, note: string) => void
  onDeleteBookmark: (id: string) => Promise<void>
}

export function VideoPlayerPage({
  source,
  gameId,
  clipId,
  initialTrim,
  initialSeekTime,
  initialStrokes,
  onStateChange,
  bookmarks,
  onCreateBookmark,
  onUpdateBookmarkNote,
  onDeleteBookmark,
}: VideoPlayerPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<MediaController>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [inPoint, setInPoint] = useState(initialTrim?.inPoint ?? 0)
  const [outPoint, setOutPoint] = useState(initialTrim?.outPoint ?? 0)
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes ?? [])
  const [penColor] = useState('#00746b')
  const [penWidth] = useState(3)

  useEffect(() => {
    if (duration > 0 && outPoint === 0) setOutPoint(duration)
  }, [duration, outPoint])

  const bounds = useCallback(
    () => ({ start: inPoint, end: outPoint > 0 ? outPoint : duration }),
    [inPoint, outPoint, duration],
  )

  const slowRev = useHoldScrub({ controller: controllerRef.current, direction: -1, speed: 0.4, bounds, onTick: setCurrentTime })
  const fastRev = useHoldScrub({ controller: controllerRef.current, direction: -1, speed: 4, bounds, onTick: setCurrentTime })
  const fastFwd = useHoldScrub({ controller: controllerRef.current, direction: 1, speed: 4, bounds, onTick: setCurrentTime })
  const slowFwd = useHoldScrub({ controller: controllerRef.current, direction: 1, speed: 0.4, bounds, onTick: setCurrentTime })

  const togglePlay = useCallback(() => {
    if (playing) controllerRef.current?.pause()
    else controllerRef.current?.play()
  }, [playing])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }, [])

  // Hudl remote's Tag button cycles between marking the in-point and the out-point (then
  // enabling loop), rather than needing two separate buttons like the on-screen In/Out controls.
  const [tagStage, setTagStage] = useState<'in' | 'out'>('in')
  const handleTag = useCallback(() => {
    if (tagStage === 'in') {
      setInPoint(currentTime)
      setOutPoint(duration)
      setTagStage('out')
    } else {
      setOutPoint(currentTime)
      setLooping(true)
      setTagStage('in')
    }
  }, [tagStage, currentTime, duration])

  const loopingBackRef = useRef(false)

  useEffect(() => {
    if (!looping || !playing || duration <= 0 || loopingBackRef.current) return
    const effectiveOut = outPoint > 0 ? outPoint : duration
    if (currentTime > inPoint && currentTime >= effectiveOut - 0.05) {
      loopingBackRef.current = true
      controllerRef.current?.seekTo(inPoint)
      setCurrentTime(inPoint)
      let attempts = 0
      const tryResume = () => {
        controllerRef.current?.play()
        attempts += 1
        if (attempts < 5) window.setTimeout(tryResume, 200)
        else loopingBackRef.current = false
      }
      window.setTimeout(tryResume, 150)
    }
  }, [currentTime, looping, playing, inPoint, outPoint, duration])

  useEffect(() => {
    if (playing) loopingBackRef.current = false
  }, [playing])

  useEffect(() => {
    onStateChange?.({ inPoint, outPoint, drawingStrokes: strokes })
  }, [inPoint, outPoint, strokes, onStateChange])

  // Bookmarks: creating pauses and hands the new row straight to the drawer for typing;
  // Prev/Next-bookmark just seeks, using the same pure helper the remote listener uses.
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [focusBookmarkId, setFocusBookmarkId] = useState<string | null>(null)
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(null)
  const [deleteBookmarkError, setDeleteBookmarkError] = useState<string | null>(null)

  const handleBookmarkClick = useCallback(() => {
    controllerRef.current?.pause()
    const t = controllerRef.current?.getCurrentTime() ?? currentTime
    const created = onCreateBookmark(t)
    setFocusBookmarkId(created.id)
    setDrawerExpanded(true)
  }, [currentTime, onCreateBookmark])

  const seekTo = useCallback((t: number) => {
    controllerRef.current?.seekTo(t)
    setCurrentTime(t)
  }, [])

  // Applies a share link's target timestamp exactly once, as soon as the video's real
  // duration is known (seeking is unreliable before metadata has loaded). The ref guard
  // matters because `duration` and `seekTo`'s own `currentTime` update can both change
  // again later — without it, a later recalculation would reseek to the same spot.
  const initialSeekAppliedRef = useRef(false)
  useEffect(() => {
    if (initialSeekAppliedRef.current || initialSeekTime == null || duration <= 0) return
    initialSeekAppliedRef.current = true
    seekTo(initialSeekTime)
  }, [initialSeekTime, duration, seekTo])

  const handlePrevBookmark = useCallback(() => {
    const target = findAdjacentBookmark(bookmarks, currentTime, -1)
    if (target) seekTo(target.timeSeconds)
  }, [bookmarks, currentTime, seekTo])

  const handleNextBookmark = useCallback(() => {
    const target = findAdjacentBookmark(bookmarks, currentTime, 1)
    if (target) seekTo(target.timeSeconds)
  }, [bookmarks, currentTime, seekTo])

  const confirmDeleteBookmark = async () => {
    if (!deletingBookmark) return
    setDeleteBookmarkError(null)
    try {
      await onDeleteBookmark(deletingBookmark.id)
      setDeletingBookmark(null)
    } catch {
      setDeleteBookmarkError('Could not delete this bookmark. Try again.')
    }
  }

  // Hudl remote support. Physically the remote is a Bluetooth HID keypad: each button sends
  // Ctrl+Shift+<digit> (confirmed by capturing raw KeyboardEvents), with a real keydown/keyup
  // pair per press (OS auto-repeats keydown while held, so `repeat` is used to fire hold-start
  // exactly once). Digit-to-button mapping: 1=Full 2=Prev-bookmark 3=Next-bookmark 4=Rev
  // 5=Slow 6=Rew 7=FF 8=Tag 9=Play. Rev/Slow/Rew/FF resume normal forward playback on release
  // (not pause), matching how the physical remote's hold buttons behave, unlike the on-screen
  // hold buttons which pause. Prev/Next used to switch between saved clips; they now step
  // between this clip's bookmarks instead — there's no on-screen equivalent for clip-switching
  // either, so nothing is lost that existed anywhere else, and bookmark navigation is far more
  // useful during actual film review.
  useEffect(() => {
    const holdActions: Record<string, ReturnType<typeof useHoldScrub>> = {
      Digit4: slowRev,
      Digit5: slowFwd,
      Digit6: fastRev,
      Digit7: fastFwd,
    }
    const tapActions: Record<string, (() => void) | undefined> = {
      Digit1: toggleFullscreen,
      Digit2: handlePrevBookmark,
      Digit3: handleNextBookmark,
      Digit8: handleTag,
      Digit9: togglePlay,
    }

    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const isRemoteChord = (e: KeyboardEvent) => e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRemoteChord(e) || isEditableTarget(e.target)) return
      const hold = holdActions[e.code]
      const tap = tapActions[e.code]
      if (!hold && !tap) return
      e.preventDefault()
      if (e.repeat) return
      if (hold) hold.start()
      else tap?.()
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const hold = holdActions[e.code]
      if (!hold) return
      e.preventDefault()
      hold.stop('play')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [slowRev, slowFwd, fastRev, fastFwd, toggleFullscreen, handlePrevBookmark, handleNextBookmark, handleTag, togglePlay])

  return (
    <div ref={containerRef} className="relative flex h-full flex-col">
      <div className="relative flex-1 bg-black">
        <VideoStage
          ref={controllerRef}
          source={source}
          onDurationChange={setDuration}
          onTimeUpdate={setCurrentTime}
          onPlayingChange={setPlaying}
        />
        <DrawingCanvas active={drawMode} color={penColor} width={penWidth} strokes={strokes} onStrokesChange={setStrokes} />
      </div>

      <div className="border-t border-white/10 bg-panel px-3 pt-2">
        <ScrubBar
          duration={duration}
          currentTime={currentTime}
          inPoint={inPoint}
          outPoint={outPoint || duration}
          onSeek={seekTo}
          onSetIn={setInPoint}
          onSetOut={setOutPoint}
        />
        <ControlBar
          playing={playing}
          onTogglePlay={togglePlay}
          slowRev={slowRev}
          fastRev={fastRev}
          fastFwd={fastFwd}
          slowFwd={slowFwd}
          onSetIn={() => setInPoint(currentTime)}
          onSetOut={() => setOutPoint(currentTime)}
          looping={looping}
          onToggleLoop={() => setLooping((v) => !v)}
          drawMode={drawMode}
          onToggleDraw={() => setDrawMode((v) => !v)}
          onResetDrawing={() => setStrokes([])}
          currentTime={currentTime}
          duration={duration}
          onBookmark={handleBookmarkClick}
        />
        <BookmarksDrawer
          bookmarks={bookmarks}
          gameId={gameId}
          clipId={clipId}
          expanded={drawerExpanded}
          onToggleExpanded={() => setDrawerExpanded((v) => !v)}
          focusBookmarkId={focusBookmarkId}
          onFocusConsumed={() => setFocusBookmarkId(null)}
          onSeek={seekTo}
          onUpdateNote={onUpdateBookmarkNote}
          onDeleteRequest={(bookmark) => {
            setDeletingBookmark(bookmark)
            setDeleteBookmarkError(null)
          }}
        />
      </div>

      {deletingBookmark && (
        <DeleteConfirmModal
          itemName="this bookmark"
          error={deleteBookmarkError}
          onConfirm={confirmDeleteBookmark}
          onCancel={() => {
            setDeletingBookmark(null)
            setDeleteBookmarkError(null)
          }}
        />
      )}
    </div>
  )
}
