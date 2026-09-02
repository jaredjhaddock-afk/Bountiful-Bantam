# Video Framing Keyframes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a coach drag a 16:9 rectangle on the video to set a "framing keyframe" at the current moment, add more at other moments, and have playback smoothly pan/zoom between them — turning a wide game-film shot into a guided close-up of the specific detail being reviewed.

**Architecture:** Framing keyframes are plain data (`{id, timeSeconds, x, y, width, height}`, fractions of the video's own rendered box) persisted per-clip, the same way trim points and drawing strokes already are. A pure interpolation function computes the current framing rect from `currentTime`, converted to a CSS `transform` applied to the layer wrapping the video — this works identically for file, YouTube, and Drive clips since it never touches anything source-specific.

**Tech Stack:** React + TypeScript, Vitest, existing `clipsStore`/Supabase persistence, plain CSS transforms (no new libraries).

---

### Task 1: Data layer — migration, type, and clip mappers

**Files:**
- Create: `supabase/migrations/0007_video_framing_keyframes.sql`
- Modify: `app/src/types/video.ts`
- Modify: `app/src/state/clipsStore.mappers.ts`
- Modify: `app/src/state/clipsStore.tsx`
- Test: `app/src/state/clipsStore.mappers.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0007_video_framing_keyframes.sql
-- Adds a jsonb column for per-clip pan/zoom framing keyframes, following the exact same
-- pattern as the existing drawing_strokes column: an array of small objects, defaulting
-- to empty, with no separate table needed. Run this once in the Supabase SQL Editor, the
-- same way 0001-0006 were run. Not executed by the app or by Claude — the anon/publishable
-- key has no schema-modification permission.

alter table clips add column framing_keyframes jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Add the `FramingKeyframe` type**

Edit `app/src/types/video.ts` — add at the end of the file:

```ts

export interface FramingKeyframe {
  id: string
  timeSeconds: number
  /** x, y, width, height are all fractions (0-1) of the video's own rendered box at the
   *  moment the keyframe was drawn — not pixels, and not fractions of the source file's
   *  native resolution. This makes a keyframe reproduce the same relative framing
   *  regardless of what size the player is displayed at later. */
  x: number
  y: number
  width: number
  height: number
}
```

- [ ] **Step 3: Write the failing mapper tests**

Replace the full file `app/src/state/clipsStore.mappers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clipToInsertRow, clipToUpdateRow, rowToClip } from './clipsStore.mappers'

describe('rowToClip', () => {
  it('maps a DB row to the app Clip shape', () => {
    const row = {
      id: '1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: 'Week 1',
      in_point: 2.5,
      out_point: 8,
      drawing_strokes: [],
      framing_keyframes: [],
      game_id: null,
    }
    expect(rowToClip(row)).toEqual({
      id: '1',
      sourceType: 'youtube',
      sourceRef: 'abc123',
      title: 'Week 1',
      inPoint: 2.5,
      outPoint: 8,
      drawingStrokes: [],
      framingKeyframes: [],
      gameId: null,
    })
  })

  it('defaults drawing_strokes to an empty array when null', () => {
    const row = {
      id: '1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: null,
      in_point: null,
      out_point: null,
      drawing_strokes: null as any,
      framing_keyframes: [],
      game_id: null,
    }
    expect(rowToClip(row).drawingStrokes).toEqual([])
  })

  it('defaults framing_keyframes to an empty array when null', () => {
    const row = {
      id: '1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: null,
      in_point: null,
      out_point: null,
      drawing_strokes: [],
      framing_keyframes: null as any,
      game_id: null,
    }
    expect(rowToClip(row).framingKeyframes).toEqual([])
  })
})

describe('clipToInsertRow / clipToUpdateRow', () => {
  const clip = {
    id: '1',
    sourceType: 'youtube' as const,
    sourceRef: 'abc123',
    title: 'Week 1',
    inPoint: null,
    outPoint: null,
    drawingStrokes: [],
    framingKeyframes: [],
    gameId: null,
  }

  it('clipToInsertRow includes team_id and snake_case columns', () => {
    expect(clipToInsertRow(clip, 'team-1')).toEqual({
      id: '1',
      team_id: 'team-1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: 'Week 1',
      game_id: null,
    })
  })

  it('clipToUpdateRow maps trim points, drawings, and framing keyframes', () => {
    const keyframe = { id: 'k1', timeSeconds: 1, x: 0, y: 0, width: 0.5, height: 0.5 }
    const withTrim = { ...clip, inPoint: 2, outPoint: 9, framingKeyframes: [keyframe] }
    expect(clipToUpdateRow(withTrim)).toEqual({
      title: 'Week 1',
      in_point: 2,
      out_point: 9,
      drawing_strokes: [],
      framing_keyframes: [keyframe],
      game_id: null,
    })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/state/clipsStore.mappers.test.ts`
Expected: FAIL — `rowToClip` output missing `framingKeyframes`, `clipToUpdateRow` output missing `framing_keyframes`.

- [ ] **Step 5: Update the mappers**

Replace the full file `app/src/state/clipsStore.mappers.ts`:

```ts
import type { FramingKeyframe, Stroke } from '../types/video'

export type ClipSourceType = 'youtube' | 'drive' | 'file'

export interface Clip {
  id: string
  sourceType: ClipSourceType
  sourceRef: string
  title: string | null
  inPoint: number | null
  outPoint: number | null
  drawingStrokes: Stroke[]
  framingKeyframes: FramingKeyframe[]
  gameId: string | null
}

export interface ClipRow {
  id: string
  source_type: string
  source_ref: string
  title: string | null
  in_point: number | null
  out_point: number | null
  drawing_strokes: Stroke[]
  framing_keyframes: FramingKeyframe[]
  game_id: string | null
}

export function rowToClip(row: ClipRow): Clip {
  return {
    id: row.id,
    sourceType: row.source_type as ClipSourceType,
    sourceRef: row.source_ref,
    title: row.title,
    inPoint: row.in_point,
    outPoint: row.out_point,
    drawingStrokes: row.drawing_strokes ?? [],
    framingKeyframes: row.framing_keyframes ?? [],
    gameId: row.game_id,
  }
}

export function clipToInsertRow(clip: Clip, teamId: string) {
  return {
    id: clip.id,
    team_id: teamId,
    source_type: clip.sourceType,
    source_ref: clip.sourceRef,
    title: clip.title,
    game_id: clip.gameId,
  }
}

export function clipToUpdateRow(clip: Clip) {
  return {
    title: clip.title,
    in_point: clip.inPoint,
    out_point: clip.outPoint,
    drawing_strokes: clip.drawingStrokes,
    framing_keyframes: clip.framingKeyframes,
    game_id: clip.gameId,
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/state/clipsStore.mappers.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Default new clips to an empty keyframe list**

Edit `app/src/state/clipsStore.tsx` — in `createClip`, change:

```tsx
      const clip: Clip = {
        id: crypto.randomUUID(),
        sourceType,
        sourceRef,
        title: title ?? null,
        inPoint: null,
        outPoint: null,
        drawingStrokes: [],
        gameId: gameId ?? null,
      }
```

to:

```tsx
      const clip: Clip = {
        id: crypto.randomUUID(),
        sourceType,
        sourceRef,
        title: title ?? null,
        inPoint: null,
        outPoint: null,
        drawingStrokes: [],
        framingKeyframes: [],
        gameId: gameId ?? null,
      }
```

- [ ] **Step 8: Verify types and full test suite**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0007_video_framing_keyframes.sql app/src/types/video.ts app/src/state/clipsStore.mappers.ts app/src/state/clipsStore.mappers.test.ts app/src/state/clipsStore.tsx
git commit -m "Add framing_keyframes to the clip data model"
```

---

### Task 2: Pure interpolation and CSS-transform math

**Deliberate refinement over the design spec:** the spec says "before the first keyframe
*and after the last*, the video shows the full, unzoomed frame." Implementing that
literally means a keyframe's own zoom is visible for a single instant and then
immediately snaps back out — and a clip with exactly one keyframe would show its zoom
for effectively zero duration, since `currentTime` almost never lands on that exact
float value. That defeats the most common, simplest use of this feature: "zoom in here
and stay zoomed for the rest of the clip." This task instead holds the *last*
keyframe's exact framing from its timestamp onward (only *before the first* keyframe
falls back to the full frame). The interpolation behavior *between* keyframes — which is
the actual "pans/zooms between them" feature — is unchanged from the spec.

**Files:**
- Create: `app/src/lib/framingTransform.ts`
- Test: `app/src/lib/framingTransform.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/framingTransform.test.ts
import { describe, expect, it } from 'vitest'
import { FULL_FRAME, framingToTransform, interpolateFraming } from './framingTransform'

const kf = (timeSeconds: number, x: number, y: number, width: number, height: number, id = `${timeSeconds}`) => ({
  id,
  timeSeconds,
  x,
  y,
  width,
  height,
})

describe('interpolateFraming', () => {
  it('returns the full frame when there are no keyframes', () => {
    expect(interpolateFraming([], 5)).toEqual(FULL_FRAME)
  })

  it('returns the full frame before the first keyframe', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 5)).toEqual(FULL_FRAME)
  })

  it('returns the exact keyframe rect at its own timestamp', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 10)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
  })

  it('holds the last keyframe rect at and after its timestamp (a single keyframe stays applied for the rest of the clip)', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 999)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
  })

  it('linearly interpolates the midpoint between two keyframes', () => {
    const keyframes = [kf(0, 0, 0, 1, 1), kf(10, 0.4, 0.2, 0.2, 0.2)]
    expect(interpolateFraming(keyframes, 5)).toEqual({ x: 0.2, y: 0.1, width: 0.6, height: 0.6 })
  })

  it('holds the last keyframe rect after the last of three keyframes', () => {
    const keyframes = [kf(0, 0, 0, 1, 1), kf(5, 0.5, 0.5, 0.25, 0.25), kf(10, 0.1, 0.1, 0.3, 0.3)]
    expect(interpolateFraming(keyframes, 20)).toEqual({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 })
  })

  it('sorts out-of-order keyframes by time before interpolating', () => {
    const keyframes = [kf(10, 0.4, 0.2, 0.2, 0.2), kf(0, 0, 0, 1, 1)]
    expect(interpolateFraming(keyframes, 5)).toEqual({ x: 0.2, y: 0.1, width: 0.6, height: 0.6 })
  })
})

describe('framingToTransform', () => {
  it('is the identity transform for the full frame', () => {
    expect(framingToTransform(FULL_FRAME)).toBe('scale(1) translate(-0%, -0%)')
  })

  it('scales and translates to zoom into a rect', () => {
    expect(framingToTransform({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).toBe('scale(2) translate(-25%, -25%)')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/lib/framingTransform.test.ts`
Expected: FAIL — `Failed to resolve import "./framingTransform"`

- [ ] **Step 3: Write the implementation**

```ts
// app/src/lib/framingTransform.ts
import type { FramingKeyframe } from '../types/video'

export interface FramingRect {
  x: number
  y: number
  width: number
  height: number
}

export const FULL_FRAME: FramingRect = { x: 0, y: 0, width: 1, height: 1 }

function toRect(k: FramingKeyframe): FramingRect {
  return { x: k.x, y: k.y, width: k.width, height: k.height }
}

/** Interpolates the framing rect at `timeSeconds` from a clip's keyframes.
 *
 *  - No keyframes, or `timeSeconds` before the first one: the full, unzoomed frame.
 *  - Between two keyframes: linear interpolation of x/y/width/height.
 *  - At or after the last keyframe: that keyframe's exact rect, held — not the full
 *    frame. A single keyframe therefore zooms in at its timestamp and stays zoomed for
 *    the rest of the clip, which is what makes one keyframe alone a useful, complete
 *    action ("zoom in here and stay") rather than a rect that's visible for a single
 *    instant and then immediately reverts. */
export function interpolateFraming(keyframes: FramingKeyframe[], timeSeconds: number): FramingRect {
  if (keyframes.length === 0) return FULL_FRAME
  const sorted = [...keyframes].sort((a, b) => a.timeSeconds - b.timeSeconds)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (timeSeconds < first.timeSeconds) return FULL_FRAME
  if (timeSeconds >= last.timeSeconds) return toRect(last)

  let prev = first
  let curr = first
  for (const k of sorted) {
    if (k.timeSeconds <= timeSeconds) prev = k
    if (k.timeSeconds >= timeSeconds) {
      curr = k
      break
    }
  }
  if (prev.id === curr.id) return toRect(prev)
  const span = curr.timeSeconds - prev.timeSeconds
  const t = span > 0 ? (timeSeconds - prev.timeSeconds) / span : 0
  return {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t,
    width: prev.width + (curr.width - prev.width) * t,
    height: prev.height + (curr.height - prev.height) * t,
  }
}

/** Converts a framing rect into the CSS transform that zooms an element (with
 *  `transform-origin: 0 0`) to show exactly that rect filling its container.
 *
 *  `1 / rect.width` is the scale factor for both axes, not just the horizontal one,
 *  because every keyframe's rectangle is locked to the same 16:9 ratio as the video's
 *  own rendered box when it's drawn — so width and height always scale by the same
 *  amount. */
export function framingToTransform(rect: FramingRect): string {
  const scale = rect.width > 0 ? 1 / rect.width : 1
  return `scale(${scale}) translate(${-rect.x * 100}%, ${-rect.y * 100}%)`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/framingTransform.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Verify the rest of the suite and types are unaffected**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/framingTransform.ts app/src/lib/framingTransform.test.ts
git commit -m "Add pure framing interpolation and CSS-transform math"
```

---

### Task 3: Framing icon and the drag-to-draw overlay

**Files:**
- Modify: `app/src/components/icons.tsx`
- Create: `app/src/components/player/FramingOverlay.tsx`

- [ ] **Step 1: Add `FrameIcon`**

Edit `app/src/components/icons.tsx` — add at the end of the file:

```tsx
export const FrameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </svg>
)
```

- [ ] **Step 2: Write `FramingOverlay`**

```tsx
// app/src/components/player/FramingOverlay.tsx
import { useRef, useState } from 'react'
import type { FramingKeyframe } from '../../types/video'

interface FramingOverlayProps {
  active: boolean
  keyframes: FramingKeyframe[]
  currentTime: number
  onKeyframeChange: (keyframes: FramingKeyframe[]) => void
}

const ASPECT = 16 / 9
// A keyframe within this many seconds of the current playhead is treated as "the one
// being adjusted" — dragging updates its rect and snaps its timestamp to the current
// playhead — rather than creating a new, separate keyframe a fraction of a second away
// from an existing one.
const SNAP_SECONDS = 0.5

interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

export function FramingOverlay({ active, keyframes, currentTime, onKeyframeChange }: FramingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragRect, setDragRect] = useState<PixelRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const rectFromDrag = (start: { x: number; y: number }, current: { x: number; y: number }): PixelRect => {
    const container = containerRef.current!
    const boundsW = container.clientWidth
    const boundsH = container.clientHeight
    const rawWidth = Math.max(Math.abs(current.x - start.x), boundsW * 0.05)
    const width = Math.min(rawWidth, boundsW)
    const height = width / ASPECT
    let left = current.x >= start.x ? start.x : start.x - width
    let top = current.y >= start.y ? start.y : start.y - height
    left = Math.min(Math.max(left, 0), boundsW - width)
    top = Math.min(Math.max(top, 0), boundsH - height)
    return { left, top, width, height }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = pointFromEvent(e)
    dragStartRef.current = start
    setDragRect(rectFromDrag(start, start))
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    setDragRect(rectFromDrag(dragStartRef.current, pointFromEvent(e)))
  }

  const handlePointerUp = () => {
    const container = containerRef.current
    if (!dragStartRef.current || !dragRect || !container) {
      dragStartRef.current = null
      setDragRect(null)
      return
    }
    const boundsW = container.clientWidth
    const boundsH = container.clientHeight
    const rect = {
      x: dragRect.left / boundsW,
      y: dragRect.top / boundsH,
      width: dragRect.width / boundsW,
      height: dragRect.height / boundsH,
    }
    const existing = keyframes.find((k) => Math.abs(k.timeSeconds - currentTime) < SNAP_SECONDS)
    const next = existing
      ? keyframes.map((k) => (k.id === existing.id ? { ...k, timeSeconds: currentTime, ...rect } : k))
      : [...keyframes, { id: crypto.randomUUID(), timeSeconds: currentTime, ...rect }]
    onKeyframeChange(next)
    dragStartRef.current = null
    setDragRect(null)
  }

  if (!active) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {keyframes.map((k) => (
        <div
          key={k.id}
          className="absolute border-2 border-white/40"
          style={{ left: `${k.x * 100}%`, top: `${k.y * 100}%`, width: `${k.width * 100}%`, height: `${k.height * 100}%` }}
        />
      ))}
      {dragRect && (
        <div
          className="absolute border-2 border-accent-teal bg-accent-teal/10"
          style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass (this component has no dedicated test — it's pointer-driven UI wrapping already-tested pure math, matching this codebase's existing convention for `DrawingCanvas`, which also has no test file).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/icons.tsx app/src/components/player/FramingOverlay.tsx
git commit -m "Add FrameIcon and the framing-keyframe drag-to-draw overlay"
```

---

### Task 4: Keyframe markers on the scrub bar

**Files:**
- Modify: `app/src/components/player/ScrubBar.tsx`

- [ ] **Step 1: Add the `framingMarkers` prop and render ticks**

Edit `app/src/components/player/ScrubBar.tsx` — change the props interface:

```tsx
interface ScrubBarProps {
  duration: number
  currentTime: number
  inPoint: number
  outPoint: number
  onSeek: (t: number) => void
  onSetIn: (t: number) => void
  onSetOut: (t: number) => void
  framingMarkers?: number[]
}
```

and the function signature:

```tsx
export function ScrubBar({ duration, currentTime, inPoint, outPoint, onSeek, onSetIn, onSetOut, framingMarkers }: ScrubBarProps) {
```

Then, inside the `trackRef` div, right after the closing tag of the current-progress fill div (the one with `bg-scrub-fill`) and before the in-point button, add:

```tsx
        {framingMarkers?.map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-accent-teal"
            style={{ left: `${pct(t)}%` }}
          />
        ))}
```

- [ ] **Step 2: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/player/ScrubBar.tsx
git commit -m "Show framing keyframes as markers on the scrub bar"
```

---

### Task 5: Frame toggle and Reset-zoom buttons in the control bar

**Files:**
- Modify: `app/src/components/player/ControlBar.tsx`

- [ ] **Step 1: Add the new props and icon import**

Edit `app/src/components/player/ControlBar.tsx` — change the icon import:

```tsx
import {
  BookmarkIcon,
  FastFwdIcon,
  FastRevIcon,
  FrameIcon,
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
```

Add to `ControlBarProps`:

```tsx
  drawMode: boolean
  onToggleDraw: () => void
  onResetDrawing: () => void
  framingMode: boolean
  onToggleFraming: () => void
  onResetFraming: () => void
  currentTime: number
```

(inserting the three new lines between `onResetDrawing: () => void` and `currentTime: number`, which are already adjacent in the current file).

Add to the destructured props, in the same relative position:

```tsx
  drawMode,
  onToggleDraw,
  onResetDrawing,
  framingMode,
  onToggleFraming,
  onResetFraming,
  currentTime,
```

- [ ] **Step 2: Add the buttons**

In the same file, change:

```tsx
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
```

to:

```tsx
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
        <button
          onClick={onToggleFraming}
          className={`rounded-standard p-1.5 ${framingMode ? 'bg-accent-teal/20 text-accent-teal' : 'text-text hover:bg-white/10'}`}
          aria-label="Toggle framing"
        >
          <FrameIcon width={16} height={16} />
        </button>
        <button onClick={onResetFraming} className="rounded-standard p-1.5 text-text hover:bg-white/10" aria-label="Reset zoom">
          <TrashIcon width={16} height={16} />
        </button>
      </div>
```

- [ ] **Step 3: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: type error in `VideoPlayerPage.tsx` — it doesn't pass the new required `ControlBar` props yet. That's fixed in Task 6; for this task, confirm the *only* new error is exactly that missing-props error at the `<ControlBar` call site, nothing else.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/player/ControlBar.tsx
git commit -m "Add Frame toggle and Reset zoom buttons to the control bar"
```

---

### Task 6: Wire framing into `VideoPlayerPage`

**This is the highest-risk task in the plan** — it changes the video-rendering layout (wrapping `VideoStage`/`DrawingCanvas` in a transformed layer, adding `overflow-hidden`) and the mode-toggle interaction (Draw/Frame mutual exclusivity) of a page that's already been through several rounds of layout changes this project. Give this one full spec-compliance + code-quality subagent review, not the lighter direct-verification pass used for this plan's other tasks.

**Files:**
- Modify: `app/src/components/player/VideoPlayerPage.tsx`

- [ ] **Step 1: Imports**

Change:

```tsx
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
```

to:

```tsx
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
```

- [ ] **Step 2: Props**

Change:

```tsx
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
```

to:

```tsx
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
```

- [ ] **Step 3: State and mutual-exclusivity handlers**

Change:

```tsx
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes ?? [])
  const [penColor] = useState('#00746b')
  const [penWidth] = useState(3)
```

to:

```tsx
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes ?? [])
  const [framingMode, setFramingMode] = useState(false)
  const [framingKeyframes, setFramingKeyframes] = useState<FramingKeyframe[]>(initialFramingKeyframes ?? [])
  const [penColor] = useState('#00746b')
  const [penWidth] = useState(3)

  // Draw and Frame both claim click-drag on the video area, so turning one on turns the
  // other off.
  const handleToggleDraw = useCallback(() => {
    setDrawMode((v) => {
      const next = !v
      if (next) setFramingMode(false)
      return next
    })
  }, [])
  const handleToggleFraming = useCallback(() => {
    setFramingMode((v) => {
      const next = !v
      if (next) setDrawMode(false)
      return next
    })
  }, [])
```

- [ ] **Step 4: Persist framing keyframes alongside trim/drawing state**

Change:

```tsx
  useEffect(() => {
    onStateChange?.({ inPoint, outPoint, drawingStrokes: strokes })
  }, [inPoint, outPoint, strokes, onStateChange])
```

to:

```tsx
  useEffect(() => {
    onStateChange?.({ inPoint, outPoint, drawingStrokes: strokes, framingKeyframes })
  }, [inPoint, outPoint, strokes, framingKeyframes, onStateChange])
```

- [ ] **Step 5: Compute the current framing transform, and wire it plus the new controls into `scrubAndControls`**

Change:

```tsx
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
        onPrevBookmark={handlePrevBookmark}
        onNextBookmark={handleNextBookmark}
      />
    </>
  )
```

to:

```tsx
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
```

- [ ] **Step 6: Apply the transform and mount the overlay**

Change:

```tsx
        <div className={`relative bg-black ${isFullscreen ? 'flex-1' : 'flex-1 lg:aspect-video lg:flex-none'}`}>
          <VideoStage
            ref={controllerRef}
            source={source}
            onDurationChange={setDuration}
            onTimeUpdate={setCurrentTime}
            onPlayingChange={setPlaying}
          />
          <DrawingCanvas active={drawMode} color={penColor} width={penWidth} strokes={strokes} onStrokesChange={setStrokes} />
          {isFullscreen && (
```

to:

```tsx
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
```

- [ ] **Step 7: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass (this closes out the type error Task 5 introduced at the `<ControlBar` call site).

- [ ] **Step 8: Commit**

```bash
git add app/src/components/player/VideoPlayerPage.tsx
git commit -m "Wire framing keyframes into VideoPlayerPage: transform, overlay, persistence"
```

---

### Task 7: Thread the clip's saved framing keyframes from `VideoReviewPage`

**Files:**
- Modify: `app/src/pages/VideoReviewPage.tsx`

- [ ] **Step 1: Import the type**

Change:

```tsx
import type { Stroke, VideoSource } from '../types/video'
```

to:

```tsx
import type { FramingKeyframe, Stroke, VideoSource } from '../types/video'
```

- [ ] **Step 2: Widen `handleClipStateChange`'s type**

Change:

```tsx
  const handleClipStateChange = useCallback(
    (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => {
```

to:

```tsx
  const handleClipStateChange = useCallback(
    (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[]; framingKeyframes: FramingKeyframe[] }) => {
```

(No other change needed here — the function body already does `{ ...current, ...state }`, which picks up the new field automatically.)

- [ ] **Step 3: Pass the clip's saved keyframes into the player**

Change:

```tsx
          initialStrokes={activeClip?.drawingStrokes}
          onStateChange={activeClip ? handleClipStateChange : undefined}
```

to:

```tsx
          initialStrokes={activeClip?.drawingStrokes}
          initialFramingKeyframes={activeClip?.framingKeyframes}
          onStateChange={activeClip ? handleClipStateChange : undefined}
```

- [ ] **Step 4: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/VideoReviewPage.tsx
git commit -m "Thread saved framing keyframes from VideoReviewPage into the player"
```

---

### Task 8: Final check and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run (from `app/`):

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test 2>&1 | tail -6 && npx oxlint 2>&1 | tail -10
```

Expected: no type errors, all tests pass (existing tests plus the new `clipsStore.mappers.test.ts` and `framingTransform.test.ts` cases), no new lint warnings beyond the pre-existing `unicorn(no-thenable)` warnings in test-mock builder files.

- [ ] **Step 2: Manual browser verification**

With the dev server running, on an open clip:

1. Click the Frame button. Confirm the video shows the full frame and the cursor becomes a crosshair over the video.
2. Drag on the video. Confirm a 16:9-locked rectangle follows the drag (dragging further right/left changes its size; the box's height always stays in a fixed 16:9 relationship to its width).
3. Release. Confirm a marker appears on the scrub bar at the current playhead position, and the rectangle's outline stays visible (faint) on the video.
4. Click Frame again to exit edit mode, then press Play from before that keyframe. Confirm the video is at full frame until the keyframe's timestamp, then holds that zoomed framing from there onward (per Task 2's `interpolateFraming` behavior).
5. Add a second keyframe at a later timestamp with a different rectangle. Play through both — confirm the video smoothly pans/zooms from the first framing to the second between their timestamps, rather than jump-cutting.
6. Re-enter Frame mode, drag inside the first keyframe's outline while the playhead is close to its original time. Confirm it adjusts that same keyframe (no new marker appears on the scrub bar) rather than creating a duplicate.
7. Click "Reset zoom". Confirm all keyframes and their scrub-bar markers disappear, and playback returns to always showing the full frame.
8. Toggle Draw mode; confirm Frame mode turns off (and vice versa) — the two are mutually exclusive.
9. Reload the page and reopen the same clip. Confirm the keyframes you set are still there (persisted).

- [ ] **Step 3: Report results**

No commit for this task — report the check output and manual verification results.
