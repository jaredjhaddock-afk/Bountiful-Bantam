import { formatTimestamp } from '../../lib/bookmarkUtils'
import {
  BookmarkIcon,
  FastFwdIcon,
  FastRevIcon,
  InIcon,
  LoopIcon,
  NextBookmarkIcon,
  OutIcon,
  PauseIcon,
  PencilIcon,
  PlayTriangleIcon,
  PrevBookmarkIcon,
  SlowFwdIcon,
  SlowRevIcon,
  TrashIcon,
} from '../icons'

interface HandlerPair {
  onMouseDown: () => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onTouchStart: () => void
  onTouchEnd: () => void
}

interface ControlBarProps {
  playing: boolean
  onTogglePlay: () => void
  slowRev: HandlerPair
  fastRev: HandlerPair
  fastFwd: HandlerPair
  slowFwd: HandlerPair
  onSetIn: () => void
  onSetOut: () => void
  looping: boolean
  onToggleLoop: () => void
  drawMode: boolean
  onToggleDraw: () => void
  onResetDrawing: () => void
  currentTime: number
  duration: number
  onBookmark: () => void
  onPrevBookmark: () => void
  onNextBookmark: () => void
}

function HoldButton({ handlers, label, children }: { handlers: HandlerPair; label: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-standard text-text hover:bg-white/10 active:bg-accent-teal/30"
      onMouseDown={handlers.onMouseDown}
      onMouseUp={handlers.onMouseUp}
      onMouseLeave={handlers.onMouseLeave}
      onTouchStart={handlers.onTouchStart}
      onTouchEnd={handlers.onTouchEnd}
    >
      {children}
    </button>
  )
}

export function ControlBar({
  playing,
  onTogglePlay,
  slowRev,
  fastRev,
  fastFwd,
  slowFwd,
  onSetIn,
  onSetOut,
  looping,
  onToggleLoop,
  drawMode,
  onToggleDraw,
  onResetDrawing,
  currentTime,
  duration,
  onBookmark,
  onPrevBookmark,
  onNextBookmark,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <div className="flex items-center gap-1">
        <HoldButton handlers={slowRev} label="Slow reverse (hold)">
          <SlowRevIcon />
        </HoldButton>
        <HoldButton handlers={fastRev} label="Fast reverse (hold)">
          <FastRevIcon />
        </HoldButton>
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={onTogglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-teal text-white hover:brightness-110"
        >
          {playing ? <PauseIcon /> : <PlayTriangleIcon />}
        </button>
        <HoldButton handlers={fastFwd} label="Fast forward (hold)">
          <FastFwdIcon />
        </HoldButton>
        <HoldButton handlers={slowFwd} label="Slow forward (hold)">
          <SlowFwdIcon />
        </HoldButton>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onSetIn}
          className="flex items-center gap-1 rounded-standard px-2 py-1 text-xs text-text hover:bg-white/10"
          aria-label="Set in point"
        >
          <InIcon width={16} height={16} /> In
        </button>
        <button
          onClick={onSetOut}
          className="flex items-center gap-1 rounded-standard px-2 py-1 text-xs text-text hover:bg-white/10"
          aria-label="Set out point"
        >
          <OutIcon width={16} height={16} /> Out
        </button>
        <button
          onClick={onToggleLoop}
          className={`rounded-standard p-1.5 ${looping ? 'bg-accent-teal/20 text-accent-teal' : 'text-text hover:bg-white/10'}`}
          aria-label="Toggle loop"
        >
          <LoopIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onPrevBookmark}
          className="rounded-standard p-1.5 text-text hover:bg-white/10"
          aria-label="Previous bookmark"
        >
          <PrevBookmarkIcon width={16} height={16} />
        </button>
        <button
          onClick={onNextBookmark}
          className="rounded-standard p-1.5 text-text hover:bg-white/10"
          aria-label="Next bookmark"
        >
          <NextBookmarkIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleDraw}
          className={`rounded-standard p-1.5 ${drawMode ? 'bg-accent-teal/20 text-accent-teal' : 'text-text hover:bg-white/10'}`}
          aria-label="Toggle drawing"
        >
          <PencilIcon width={16} height={16} />
        </button>
        <button onClick={onResetDrawing} className="rounded-standard p-1.5 text-text hover:bg-white/10" aria-label="Clear drawing">
          <TrashIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted">
          {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
        </span>
        <button
          onClick={onBookmark}
          className="flex items-center gap-1 rounded-standard px-2 py-1 text-xs text-text hover:bg-white/10"
          aria-label="Bookmark this moment"
        >
          <BookmarkIcon width={16} height={16} /> Bookmark
        </button>
      </div>
    </div>
  )
}
