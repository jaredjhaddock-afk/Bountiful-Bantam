import { useCallback, useEffect, useRef, useState } from 'react'
import type { FramingKeyframe, MediaController, Stroke, VideoSource } from '../../types/video'
import type { Bookmark } from '../../state/bookmarksStore'
import { useHoldScrub } from '../../lib/useHoldScrub'
import { findAdjacentBookmark } from '../../lib/bookmarkUtils'
import { FULL_FRAME, framingToTransform, interpolateFraming } from '../../lib/framingTransform'
import { ControlBar } from './ControlBar'
import { BookmarksDrawer } from './BookmarksDrawer'
import { DrawingCanvas } from './DrawingCanvas'
import { FramingOverlay } from './FramingOverlay'
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
  initialFramingKeyframes?: FramingKeyframe[]
  onStateChange?: (state: {
    inPoint: number
    outPoint: number
    drawingStrokes: Stroke[]
    framingKeyframes: FramingKeyframe[]
  }) => void
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
  initialFramingKeyframes,
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
  const [framingMode, setFramingMode] = useState(false)
  const [framingKeyframes, setFramingKeyframes] = useState<FramingKeyframe[]>(initialFramingKeyframes ?? [])
  const [penColor] = useState('#00746b')
  const [penWidth] = useState(3)

  // Draw and Frame both claim click-drag on the video area, so turning one on turns the
  // other off. Each setState call is a separate top-level statement rather than nesting
  // one inside the other's updater function — React StrictMode double-invokes updater
  // functions in dev to surface exactly this kind of impurity (same convention as
  // VideoReviewPage's handleClipStateChange).
  const handleToggleDraw = useCallback(() => {
    const next = !drawMode
    setDrawMode(next)
    if (next) setFramingMode(false)
  }, [drawMode])
  const handleToggleFraming = useCallback(() => {
    const next = !framingMode
    setFramingMode(next)
    if (next) setDrawMode(false)
  }, [framingMode])

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

  // Fullscreen controls overlay the video and auto-hide after a couple seconds of no mouse
  // movement, matching standard video-player behavior — outside fullscreen the controls
  // just sit in normal document flow below the video and are always visible.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const [controlsVisible, setControlsVisible] = useState(true)
  const hideControlsTimeoutRef = useRef<number | null>(null)
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true)
    if (hideControlsTimeoutRef.current != null) window.clearTimeout(hideControlsTimeoutRef.current)
    hideControlsTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 2500)
  }, [])
  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true)
      if (hideControlsTimeoutRef.current != null) window.clearTimeout(hideControlsTimeoutRef.current)
      return
    }
    showControlsTemporarily()
    return () => {
      if (hideControlsTimeoutRef.current != null) window.clearTimeout(hideControlsTimeoutRef.current)
    }
  }, [isFullscreen, showControlsTemporarily])

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
    onStateChange?.({ inPoint, outPoint, drawingStrokes: strokes, framingKeyframes })
  }, [inPoint, outPoint, strokes, framingKeyframes, onStateChange])

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
  // 5=Slow 6=Rew 7=FF 8=Tag 9=Play. Rev/Slow (the two 0.4x buttons, used for frame-by-frame film
  // review) pause on release, same as the on-screen hold buttons — releasing freezes on whatever
  // frame it lands on. Rew/FF (the two 4x buttons, used for scrubbing through the timeline) still
  // resume normal forward playback on release. Prev/Next used to switch between saved clips; they
  // now step between this clip's bookmarks instead — there's no on-screen equivalent for
  // clip-switching either, so nothing is lost that existed anywhere else, and bookmark navigation
  // is far more useful during actual film review.
  useEffect(() => {
    const holdActions: Record<string, ReturnType<typeof useHoldScrub>> = {
      Digit4: slowRev,
      Digit5: slowFwd,
      Digit6: fastRev,
      Digit7: fastFwd,
    }
    // The two slow (0.4x) buttons pause on release, for frame-accurate film review; the two
    // fast (4x) buttons keep resuming normal playback on release.
    const pauseOnReleaseCodes = new Set(['Digit4', 'Digit5'])
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
      // eslint-disable-next-line no-console
      console.log('[remote] keydown', e.code)
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
      hold.stop(pauseOnReleaseCodes.has(e.code) ? 'pause' : 'play')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [slowRev, slowFwd, fastRev, fastFwd, toggleFullscreen, handlePrevBookmark, handleNextBookmark, handleTag, togglePlay])

  // In edit mode the video always shows the full, unzoomed frame — so the coach can see
  // the whole picture while placing or adjusting a keyframe — regardless of what the
  // interpolated framing at the current time would otherwise be.
  const framingRect = framingMode ? FULL_FRAME : interpolateFraming(framingKeyframes, currentTime)
  const framingTransformCss = framingToTransform(framingRect)

  const scrubAndControls = (
    <>
      <ScrubBar
        duration={duration}
        currentTime={currentTime}
        inPoint={inPoint}
        outPoint={outPoint || duration}
        onSeek={seekTo}
        onSetIn={setInPoint}
        onSetOut={setOutPoint}
        framingMarkers={framingKeyframes.map((k) => k.timeSeconds)}
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
        onToggleDraw={handleToggleDraw}
        onResetDrawing={() => setStrokes([])}
        framingMode={framingMode}
        onToggleFraming={handleToggleFraming}
        onResetFraming={() => setFramingKeyframes([])}
        currentTime={currentTime}
        duration={duration}
        onBookmark={handleBookmarkClick}
        onPrevBookmark={handlePrevBookmark}
        onNextBookmark={handleNextBookmark}
      />
    </>
  )

  const bookmarksDrawerProps = {
    bookmarks,
    gameId,
    clipId,
    focusBookmarkId,
    onFocusConsumed: () => setFocusBookmarkId(null),
    onSeek: seekTo,
    onUpdateNote: onUpdateBookmarkNote,
    onDeleteRequest: (bookmark: Bookmark) => {
      setDeletingBookmark(bookmark)
      setDeleteBookmarkError(null)
    },
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col lg:flex-row"
      onMouseMove={isFullscreen ? showControlsTemporarily : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`relative overflow-hidden bg-black ${isFullscreen ? 'flex-1' : 'flex-1 lg:aspect-video lg:flex-none'}`}>
          <div className="absolute inset-0" style={{ transform: framingTransformCss, transformOrigin: '0 0' }}>
            <VideoStage
              ref={controllerRef}
              source={source}
              onDurationChange={setDuration}
              onTimeUpdate={setCurrentTime}
              onPlayingChange={setPlaying}
            />
            <DrawingCanvas active={drawMode} color={penColor} width={penWidth} strokes={strokes} onStrokesChange={setStrokes} />
          </div>
          <FramingOverlay active={framingMode} keyframes={framingKeyframes} currentTime={currentTime} onKeyframeChange={setFramingKeyframes} />
          {isFullscreen && (
            <div
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3 pb-2 pt-10 transition-opacity duration-300 ${
                controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {scrubAndControls}
            </div>
          )}
        </div>

        {!isFullscreen && (
          <div className="border-t border-white/10 bg-panel px-3 pt-2">
            {scrubAndControls}
            {/* Narrower than `lg`: collapsible drawer below the controls, same layout this
               page has always used. The always-visible side panel below replaces this at
               `lg` and up instead. */}
            <div className="lg:hidden">
              <BookmarksDrawer
                {...bookmarksDrawerProps}
                layout="drawer"
                expanded={drawerExpanded}
                onToggleExpanded={() => setDrawerExpanded((v) => !v)}
              />
            </div>
          </div>
        )}
      </div>

      {!isFullscreen && (
        <div className="hidden border-t border-white/10 bg-panel lg:flex lg:w-80 lg:flex-col lg:border-l lg:border-t-0 xl:w-96">
          <BookmarksDrawer {...bookmarksDrawerProps} layout="panel" expanded onToggleExpanded={() => {}} />
        </div>
      )}

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
