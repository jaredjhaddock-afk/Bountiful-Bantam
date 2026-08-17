# Formation Editor Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the formation editor so a new offensive formation starts with all 11 standard tokens pre-placed and real-position-labeled, clicking any token opens a Color & Label panel (rename/recolor/restyle), formations already in the database become editable, a Mirror action duplicates a formation flipped left-right (with linemen always relabeled LT→RT reading left to right), and the field background becomes labeled 5/10/15-yard lines instead of an unlabeled line stack.

**Architecture:** Two new pure/testable modules (`formationDefaults.ts`, `mirrorFormation.ts`) hold the data-shape logic so the tricky bits (default layout, mirror math, lineman relabeling) are unit-tested without touching React. A new shared `FieldBackground.tsx` SVG component replaces the duplicated `YARD_LINES` constant in `FormationCanvas.tsx` — built to be reused by the play editor's `FieldCanvas` in a later phase, but only wired into `FormationCanvas` here. Two new small presentational components (`ColorLabelPanel.tsx`, `MirrorNameModal.tsx`) follow the existing `NewCategoryModal.tsx` pattern. Everything else is scoped to **offense** — defense/special-teams formations keep today's "arm a role, click to place" flow unchanged, since the reference layout (X/F/Y/Z/H/QB/line) is an offense-specific convention the user never asked to be invented for other units.

**Tech Stack:** React + TypeScript, existing `usePlaybook()` Supabase-backed store, Vitest for the two pure-function modules.

---

## Scope Check

This is Phase 1 of 3 (see `docs/superpowers/specs/2026-08-17-formation-editor-enhancements-design.md`). Phase 2 (play editor field redesign reusing `FieldBackground.tsx`, route-drawing/segment-styling engine) and Phase 3 (play editor toolbar fixes, annotations) are separate specs/plans, not covered here.

## File Structure

```
app/src/
├── types/play.ts                          # MODIFIED — PlayerToken gains color?/fillStyle?, new FillStyle type
├── lib/
│   ├── formationDefaults.ts               # NEW — position-label lists + default 11-token offense layout
│   ├── mirrorFormation.ts                 # NEW — pure mirror function
│   └── mirrorFormation.test.ts            # NEW
├── components/
│   ├── icons.tsx                          # MODIFIED — + MirrorIcon
│   └── templates/
│       ├── FieldBackground.tsx            # NEW — shared labeled yard-line SVG background
│       ├── FormationCanvas.tsx            # MODIFIED — uses FieldBackground, renders color/fillStyle
│       ├── ColorLabelPanel.tsx            # NEW — rename + color palette + fill-style row
│       ├── MirrorNameModal.tsx            # NEW — name prompt for the mirrored copy
│       ├── FormationEditorView.tsx        # MODIFIED — pre-populated offense defaults, edit-existing, panel + mirror wiring
│       ├── FormationsGallery.tsx          # MODIFIED — tiles are clickable to edit
│       └── TemplatesView.tsx              # MODIFIED — tracks which formation id is being edited
└── state/playbookStore.tsx                # MODIFIED — + updateFormation
```

---

### Task 1: Player-token type additions and formation defaults

**Files:**
- Modify: `app/src/types/play.ts`
- Create: `app/src/lib/formationDefaults.ts`

- [ ] **Step 1: Add `color`/`fillStyle` to the shared player-token type**

Modify `app/src/types/play.ts`. Add a new exported type right after `AnnotationKind` (line 4):
```ts
export type FillStyle = 'solid' | 'outline' | 'half-left' | 'half-right' | 'half-top' | 'half-bottom' | 'quarter-left' | 'quarter-right'
```
Then modify the `PlayerToken` interface (currently lines 11-19) to add two optional fields:
```ts
export interface PlayerToken {
  id: string
  label: string
  role: PlayerRole
  x: number
  y: number
  route: RoutePoint[]
  routeStyle?: RouteStyle
  color?: string
  fillStyle?: FillStyle
}
```
`Formation.players` (`Omit<PlayerToken, 'route' | 'routeStyle'>[]`) picks up `color`/`fillStyle` automatically — no change needed to the `Formation` interface itself.

- [ ] **Step 2: Write the position-label lists and default offense layout**

Write `app/src/lib/formationDefaults.ts`:
```ts
import type { Formation, PlayerRole } from '../types/play'

/** The only skill-position labels offered in the formation editor's rename flow. */
export const SKILL_POSITION_LABELS = ['X', 'F', 'Y', 'Z', 'H'] as const

/** The 5 offensive line labels, always read left-to-right in this order — see mirrorFormation.ts. */
export const LINEMAN_LABELS = ['LT', 'LG', 'C', 'RG', 'RT'] as const

const DEFAULT_COLOR: Record<PlayerRole, string> = {
  qb: '#900203',
  skill: '#00746b',
  lineman: '#4d4d4d',
  defense: '#e50101',
  specialTeams: '#00746b',
}

function token(id: string, label: string, role: PlayerRole, x: number, y: number): Formation['players'][number] {
  return { id, label, role, x, y, color: DEFAULT_COLOR[role], fillStyle: 'outline' }
}

/**
 * The 11 tokens a brand-new offensive formation starts with. Coordinates use the existing
 * 100(w) x 60(h) field viewBox with the line of scrimmage at y=30: X/LT/LG/C/RG/RT/Y sit on
 * the LOS, F/Z a few yards back off the line, Q centered in the backfield, H directly behind Q.
 * Returns a fresh array each call (not a shared constant) so multiple editor sessions never
 * accidentally share object references.
 */
export function createDefaultOffensePlayers(): Formation['players'] {
  return [
    token('x', 'X', 'skill', 22, 30),
    token('lt', 'LT', 'lineman', 42, 30),
    token('lg', 'LG', 'lineman', 46, 30),
    token('c', 'C', 'lineman', 50, 30),
    token('rg', 'RG', 'lineman', 54, 30),
    token('rt', 'RT', 'lineman', 58, 30),
    token('y', 'Y', 'skill', 78, 30),
    token('f', 'F', 'skill', 32, 36),
    token('q', 'Q', 'qb', 50, 38),
    token('h', 'H', 'skill', 50, 44),
    token('z', 'Z', 'skill', 82, 36),
  ]
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/types/play.ts app/src/lib/formationDefaults.ts
git commit -m "Add color/fillStyle to player tokens and default offense formation layout"
```

---

### Task 2: Mirror math

**Files:**
- Create: `app/src/lib/mirrorFormation.ts`
- Test: `app/src/lib/mirrorFormation.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `app/src/lib/mirrorFormation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mirrorFormation } from './mirrorFormation'
import type { Formation } from '../types/play'

describe('mirrorFormation', () => {
  it('flips x for every token and leaves y unchanged', () => {
    const players: Formation['players'] = [{ id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#00746b', fillStyle: 'outline' }]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored[0].x).toBe(80)
    expect(mirrored[0].y).toBe(30)
  })

  it('keeps a skill/QB token\'s own label attached through the flip', () => {
    const players: Formation['players'] = [
      { id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#00746b', fillStyle: 'outline' },
      { id: 'z', label: 'Z', role: 'skill', x: 80, y: 36, color: '#00746b', fillStyle: 'outline' },
      { id: 'q', label: 'Q', role: 'qb', x: 50, y: 38, color: '#900203', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored.find((p) => p.id === 'x')).toMatchObject({ label: 'X', x: 80 })
    expect(mirrored.find((p) => p.id === 'z')).toMatchObject({ label: 'Z', x: 20 })
    expect(mirrored.find((p) => p.id === 'q')).toMatchObject({ label: 'Q', x: 50 })
  })

  it('relabels the 5 linemen by their post-mirror left-to-right order, regardless of prior label or id', () => {
    // Default order (already symmetric around x=50): mirroring should reproduce LT..RT left to right.
    const defaultOrder: Formation['players'] = [
      { id: 'lt', label: 'LT', role: 'lineman', x: 42, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'lg', label: 'LG', role: 'lineman', x: 46, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'c', label: 'C', role: 'lineman', x: 50, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rg', label: 'RG', role: 'lineman', x: 54, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rt', label: 'RT', role: 'lineman', x: 58, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(defaultOrder, 100)
    const sorted = [...mirrored].sort((a, b) => a.x - b.x)
    expect(sorted.map((p) => p.label)).toEqual(['LT', 'LG', 'C', 'RG', 'RT'])
  })

  it('relabels correctly even when a lineman was previously dragged out of order', () => {
    // The coach dragged the original "RT" (id 'rt') to the far left before mirroring.
    const shuffled: Formation['players'] = [
      { id: 'lt', label: 'LT', role: 'lineman', x: 46, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'lg', label: 'LG', role: 'lineman', x: 50, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'c', label: 'C', role: 'lineman', x: 54, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rg', label: 'RG', role: 'lineman', x: 58, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rt', label: 'RT', role: 'lineman', x: 20, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(shuffled, 100)
    const sorted = [...mirrored].sort((a, b) => a.x - b.x)
    // Mirrored x's: lt->54, lg->50, c->46, rg->42, rt->80. Sorted ascending: rg(42), c(46), lg(50), lt(54), rt(80).
    expect(sorted.map((p) => p.id)).toEqual(['rg', 'c', 'lg', 'lt', 'rt'])
    expect(sorted.map((p) => p.label)).toEqual(['LT', 'LG', 'C', 'RG', 'RT'])
  })

  it('preserves color and fillStyle through the mirror', () => {
    const players: Formation['players'] = [{ id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#d0021b', fillStyle: 'solid' }]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored[0]).toMatchObject({ color: '#d0021b', fillStyle: 'solid' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- mirrorFormation`
Expected: FAIL — `Cannot find module './mirrorFormation'`

- [ ] **Step 3: Implement the mirror function**

Write `app/src/lib/mirrorFormation.ts`:
```ts
import type { Formation } from '../types/play'
import { LINEMAN_LABELS } from './formationDefaults'

/**
 * Flips every token's x-coordinate horizontally (x' = fieldWidth - x). Skill/QB tokens keep
 * their own label attached to the same token. The 5 lineman tokens are special-cased: after
 * flipping, they're relabeled by their resulting left-to-right sorted x-order (LT, LG, C, RG,
 * RT), so the line always reads correctly left to right regardless of which physical token
 * ends up where, or what it was labeled before.
 */
export function mirrorFormation(players: Formation['players'], fieldWidth: number): Formation['players'] {
  const flipped = players.map((p) => ({ ...p, x: fieldWidth - p.x }))

  const linemen = flipped.filter((p) => p.role === 'lineman').sort((a, b) => a.x - b.x)
  const relabeledLinemen = new Map(linemen.map((p, i) => [p.id, LINEMAN_LABELS[i]]))

  return flipped.map((p) => (p.role === 'lineman' ? { ...p, label: relabeledLinemen.get(p.id)! } : p))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- mirrorFormation`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/lib/mirrorFormation.ts app/src/lib/mirrorFormation.test.ts
git commit -m "Add formation mirror math with lineman relabel-by-sorted-order"
```

---

### Task 3: Shared field background and token fill styles

**Files:**
- Create: `app/src/components/templates/FieldBackground.tsx`
- Modify: `app/src/components/templates/FormationCanvas.tsx`

- [ ] **Step 1: Write the shared field background component**

Write `app/src/components/templates/FieldBackground.tsx`:
```tsx
/**
 * Labeled 5/10/15-yard lines mirrored above and below the line of scrimmage, on the existing
 * 100(w) x 60(h) field viewBox convention (LOS at y=30). Shared by the formation editor now;
 * the play editor's FieldCanvas adopts the same component in a later phase.
 */
const YARD_MARKS = [
  { yardLabel: '5', y: 20 },
  { yardLabel: '10', y: 10 },
  { yardLabel: '15', y: 0 },
  { yardLabel: '5', y: 40 },
  { yardLabel: '10', y: 50 },
  { yardLabel: '15', y: 60 },
]

export function FieldBackground() {
  return (
    <>
      {YARD_MARKS.map(({ yardLabel, y }, i) => (
        <g key={i}>
          <line x1={0} y1={y} x2={100} y2={y} stroke="#3a434d" strokeWidth={0.15} />
          <text x={2} y={y - 0.7} fontSize={2.6} fill="#5a6470" fontFamily="Barlow Condensed, sans-serif">
            {yardLabel}
          </text>
          <text x={98} y={y - 0.7} fontSize={2.6} fill="#5a6470" fontFamily="Barlow Condensed, sans-serif" textAnchor="end">
            {yardLabel}
          </text>
        </g>
      ))}
      <line x1={0} y1={30} x2={100} y2={30} stroke="#5a6470" strokeWidth={0.25} />
    </>
  )
}
```

- [ ] **Step 2: Wire it into FormationCanvas and add fill-style-aware token rendering**

Read the current `app/src/components/templates/FormationCanvas.tsx` first (it hasn't changed since it was written — the version below replaces it in full). Replace it with:
```tsx
import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { FillStyle, Formation } from '../../types/play'
import { FieldBackground } from './FieldBackground'

const ROLE_COLOR: Record<string, string> = {
  qb: '#900203',
  skill: '#00746b',
  lineman: '#4d4d4d',
  defense: '#e50101',
  specialTeams: '#00746b',
}

type DraftPlayer = Formation['players'][number]

interface FormationCanvasProps {
  players: DraftPlayer[]
  selectedId: string | null
  armed: boolean
  onAddPlayer: (point: { x: number; y: number }) => void
  onSelectPlayer: (id: string) => void
  onMovePlayer: (id: string, point: { x: number; y: number }) => void
}

const TOKEN_RADIUS = 1.8

/** A rect (in the token's local -r..r coordinate space) that, combined with clip-path on a
 *  fully-colored shape, produces each fill-style variant. `null` means "outline" — no fill. */
function fillClipRect(style: FillStyle, r: number): { x: number; y: number; width: number; height: number } | null {
  switch (style) {
    case 'solid':
      return { x: -r, y: -r, width: 2 * r, height: 2 * r }
    case 'half-left':
      return { x: -r, y: -r, width: r, height: 2 * r }
    case 'half-right':
      return { x: 0, y: -r, width: r, height: 2 * r }
    case 'half-top':
      return { x: -r, y: -r, width: 2 * r, height: r }
    case 'half-bottom':
      return { x: -r, y: 0, width: 2 * r, height: r }
    case 'quarter-left':
      return { x: -r, y: -r, width: r / 2, height: 2 * r }
    case 'quarter-right':
      return { x: r / 2, y: -r, width: r / 2, height: 2 * r }
    case 'outline':
      return null
  }
}

export function FormationCanvas({ players, selectedId, armed, onAddPlayer, onSelectPlayer, onMovePlayer }: FormationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const suppressNextClick = useRef(false)

  const pointFromEvent = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return {
      x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.height,
    }
  }

  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    if (!armed) return
    onAddPlayer(pointFromEvent(e))
  }

  const handleTokenMouseDown = (id: string) => (e: ReactMouseEvent) => {
    e.stopPropagation()
    dragRef.current = { id, moved: false }
    suppressNextClick.current = true
  }

  const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    dragRef.current.moved = true
    onMovePlayer(dragRef.current.id, pointFromEvent(e))
  }

  const endDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag && !drag.moved) onSelectPlayer(drag.id)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 60"
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      style={{ width: '100%', height: '100%', background: '#161a1d', cursor: armed ? 'copy' : 'default' }}
    >
      <FieldBackground />

      {players.map((p) => {
        const color = p.color ?? ROLE_COLOR[p.role]
        const fillStyle = p.fillStyle ?? 'outline'
        const isLineman = p.role === 'lineman'
        const clip = fillClipRect(fillStyle, TOKEN_RADIUS)
        const clipId = `fill-clip-${p.id}`
        const fill = clip ? color : isLineman ? 'none' : 'rgba(0,0,0,0)'
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} onMouseDown={handleTokenMouseDown(p.id)} style={{ cursor: 'grab' }}>
            {clip && (
              <clipPath id={clipId}>
                <rect x={clip.x} y={clip.y} width={clip.width} height={clip.height} />
              </clipPath>
            )}
            {isLineman ? (
              <rect
                x={-1.6}
                y={-1.6}
                width={3.2}
                height={3.2}
                fill={fill}
                clipPath={clip ? `url(#${clipId})` : undefined}
                stroke={color}
                strokeWidth={0.3}
              />
            ) : (
              <circle r={TOKEN_RADIUS} fill={fill} clipPath={clip ? `url(#${clipId})` : undefined} stroke={color} strokeWidth={0.3} />
            )}
            {p.id === selectedId && <circle r={2.4} fill="none" stroke="#ffffff" strokeWidth={0.25} />}
            <text textAnchor="middle" dominantBaseline="central" fontSize={1.5} fill={color} fontFamily="Barlow Condensed, sans-serif" fontWeight={700}>
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```
(Changes from the current file: the inline `YARD_LINES` array and its two `<line>`-rendering blocks are replaced by `<FieldBackground />`; token rendering now reads `p.color`/`p.fillStyle` with fallback to the old role-based color and outline style, so formations without these fields — anything saved before this change — still render exactly as before.)

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `cd app && npm test`
Expected: all existing tests still pass (this task changes no test files).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/templates/FieldBackground.tsx app/src/components/templates/FormationCanvas.tsx
git commit -m "Add shared labeled field background and fill-style token rendering"
```

---

### Task 4: Color & Label panel

**Files:**
- Create: `app/src/components/templates/ColorLabelPanel.tsx`

- [ ] **Step 1: Write the panel component**

This is a controlled, presentational component — it holds no formation state itself, just a local draft of the label text so typing doesn't require a parent re-render on every keystroke. The parent (`FormationEditorView`, wired in Task 7) owns validation (duplicate-label rejection) and applies changes via the three callback props.

Write `app/src/components/templates/ColorLabelPanel.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { FillStyle } from '../../types/play'

interface ColorLabelPanelProps {
  label: string
  color: string
  fillStyle: FillStyle
  error: string | null
  onRename: (label: string) => void
  onColorChange: (color: string) => void
  onFillStyleChange: (fillStyle: FillStyle) => void
  onClose: () => void
}

const PALETTE = [
  '#d0021b', '#f5a623', '#f8e71c', '#7ed321', '#4a90d9', '#9013fe', '#bbbbbb', '#4a4a4a',
  '#b8005c', '#d9541e', '#c98f00', '#00746b', '#1c5fa8', '#6b1fc9', '#5a6470', '#0a0a0a',
]

const FILL_STYLE_OPTIONS: FillStyle[] = ['solid', 'half-left', 'half-right', 'half-top', 'half-bottom', 'quarter-left', 'quarter-right', 'outline']

export function ColorLabelPanel({ label, color, fillStyle, error, onRename, onColorChange, onFillStyleChange, onClose }: ColorLabelPanelProps) {
  const [draft, setDraft] = useState(label)

  // Keep the draft in sync when a different token is selected (label prop changes identity of what's being edited).
  useEffect(() => {
    setDraft(label)
  }, [label])

  return (
    <div className="absolute left-1/2 top-3 z-10 w-[min(92%,480px)] -translate-x-1/2 rounded-standard border border-white/10 bg-panel shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-widest text-muted">Color &amp; Label</span>
        <button onClick={onClose} className="text-sm text-muted hover:text-text" aria-label="Done">
          Done
        </button>
      </div>
      <div className="flex gap-3 p-4">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onRename(e.target.value)
          }}
          className="h-11 w-11 shrink-0 rounded-standard bg-app-bg text-center text-sm outline-none"
        />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                onClick={() => onColorChange(swatch)}
                aria-label={`Color ${swatch}`}
                className="h-[18px] w-[18px] rounded-full"
                style={{ background: swatch, outline: swatch === color ? '2px solid #ffffff' : 'none' }}
              />
            ))}
          </div>
        </div>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-alert-red">{error}</p>}
      <div className="flex flex-wrap gap-1.5 px-4 pb-4">
        {FILL_STYLE_OPTIONS.map((style) => (
          <button
            key={style}
            onClick={() => onFillStyleChange(style)}
            aria-label={`Fill style ${style}`}
            className="h-[22px] w-[22px] rounded-full border"
            style={{
              borderColor: style === fillStyle ? '#ffffff' : '#5a6470',
              borderWidth: style === fillStyle ? 2 : 1,
              background: style === 'outline' ? 'transparent' : '#8890a0',
              clipPath: style === 'solid' || style === 'outline' ? undefined : `inset(${clipInsetFor(style)})`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function clipInsetFor(style: Exclude<FillStyle, 'solid' | 'outline'>): string {
  switch (style) {
    case 'half-left':
      return '0 50% 0 0'
    case 'half-right':
      return '0 0 0 50%'
    case 'half-top':
      return '0 0 50% 0'
    case 'half-bottom':
      return '50% 0 0 0'
    case 'quarter-left':
      return '0 75% 0 0'
    case 'quarter-right':
      return '0 0 0 75%'
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. (This component isn't wired up anywhere yet — that's Task 7 — so it isn't reachable in the running app, but it must still typecheck standalone.)

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/templates/ColorLabelPanel.tsx
git commit -m "Add Color & Label panel component for formation token editing"
```

---

### Task 5: Mirror name modal

**Files:**
- Create: `app/src/components/templates/MirrorNameModal.tsx`
- Modify: `app/src/components/icons.tsx`

- [ ] **Step 1: Add a mirror icon**

Modify `app/src/components/icons.tsx`. Add this export after `TrashIcon` (or anywhere in the file alongside the other icons — exact position doesn't matter, all icons are flat exports):
```tsx
export const MirrorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v18" />
    <path d="M7 8l-3 4 3 4" />
    <path d="M17 8l3 4-3 4" />
  </svg>
)
```

- [ ] **Step 2: Write the mirror name modal**

This follows the exact same shell pattern as `NewCategoryModal.tsx` (Cancel / title / Confirm header, single text input) — read that file first if you haven't already, for the visual convention.

Write `app/src/components/templates/MirrorNameModal.tsx`:
```tsx
import { useState } from 'react'
import { CheckIcon, NoIcon } from '../icons'

interface MirrorNameModalProps {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function MirrorNameModal({ defaultName, onConfirm, onCancel }: MirrorNameModalProps) {
  const [name, setName] = useState(defaultName)

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onCancel} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">Mirror Formation</span>
          <button onClick={() => onConfirm(name.trim())} disabled={!name.trim()} className="text-accent-teal disabled:opacity-40" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New formation name"
            className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/icons.tsx app/src/components/templates/MirrorNameModal.tsx
git commit -m "Add mirror icon and mirror-name modal"
```

---

### Task 6: updateFormation in the playbook store

**Files:**
- Modify: `app/src/state/playbookStore.tsx`

- [ ] **Step 1: Add updateFormation to the context interface and provider**

Read the current `app/src/state/playbookStore.tsx` first. Modify the `PlaybookContextValue` interface: add this line right after `createFormation: (input: { name: string; unit: Unit; players: Formation['players'] }) => Promise<Formation>`:
```ts
  updateFormation: (formation: Formation) => Promise<void>
```

Add this new callback right after the existing `createFormation` implementation (after its closing `)` and before `createCategory`):
```ts
  const updateFormation: PlaybookContextValue['updateFormation'] = useCallback(async (formation: Formation) => {
    const { error } = await supabase.from('formations').update({ name: formation.name, players: formation.players }).eq('id', formation.id)
    if (error) throw error
    setFormations((prev) => prev.map((f) => (f.id === formation.id ? formation : f)))
  }, [])
```

Add `updateFormation,` to both the `value` object literal (right after `createFormation,`) and the `useMemo` dependency array (right after `createFormation` in the deps list).

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `cd app && npm test`
Expected: all existing tests still pass (`playbookStore.test.tsx` mocks Supabase and doesn't exercise `updateFormation`, so it's unaffected).

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/playbookStore.tsx
git commit -m "Add updateFormation to the playbook store"
```

---

### Task 7: Wire it all together in the formation editor

**Files:**
- Modify: `app/src/components/templates/FormationEditorView.tsx`
- Modify: `app/src/components/templates/FormationsGallery.tsx`
- Modify: `app/src/components/templates/TemplatesView.tsx`

- [ ] **Step 1: Make formation tiles in the gallery clickable to edit**

Read the current `app/src/components/templates/FormationsGallery.tsx` first. Replace it with:
```tsx
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { FieldCanvas } from '../editor/FieldCanvas'

interface FormationsGalleryProps {
  unit: Unit
  onNewFormation: () => void
  onEditFormation: (formationId: string) => void
}

export function FormationsGallery({ unit, onNewFormation, onEditFormation }: FormationsGalleryProps) {
  const { formationsForUnit } = usePlaybook()
  const formations = formationsForUnit(unit)

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <button
        onClick={onNewFormation}
        className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
      >
        + New Formation
      </button>
      {formations.map((f) => (
        <button
          key={f.id}
          onClick={() => onEditFormation(f.id)}
          className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg text-left hover:border-accent-teal"
        >
          <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
            <FieldCanvas players={f.players.map((p) => ({ ...p, route: [] }))} readOnly />
          </div>
          <div className="px-2 pb-2 text-sm">{f.name}</div>
        </button>
      ))}
    </div>
  )
}
```
(Only change: each formation tile is now a `<button onClick={() => onEditFormation(f.id)}>` instead of a plain non-interactive `<div>`; `onEditFormation` is a new required prop.)

- [ ] **Step 2: Track which formation is being edited in TemplatesView**

Read the current `app/src/components/templates/TemplatesView.tsx` first. Replace the `editingFormation` boolean state and its one usage:

Change:
```tsx
  const [editingFormation, setEditingFormation] = useState(false)
```
to:
```tsx
  const [editingFormationId, setEditingFormationId] = useState<string | 'new' | null>(null)
```

Change:
```tsx
  if (editingFormation) {
    return <FormationEditorView unit={unit} nav={nav} onBack={() => setEditingFormation(false)} />
  }
```
to:
```tsx
  if (editingFormationId) {
    return (
      <FormationEditorView
        unit={unit}
        nav={nav}
        formationId={editingFormationId === 'new' ? undefined : editingFormationId}
        onBack={() => setEditingFormationId(null)}
      />
    )
  }
```

Change:
```tsx
      {tab === 'formations' && <FormationsGallery unit={unit} onNewFormation={() => setEditingFormation(true)} />}
```
to:
```tsx
      {tab === 'formations' && (
        <FormationsGallery unit={unit} onNewFormation={() => setEditingFormationId('new')} onEditFormation={(id) => setEditingFormationId(id)} />
      )}
```

- [ ] **Step 3: Rewrite FormationEditorView with the offense pre-populated flow, edit-existing loading, Color & Label panel, and Mirror**

Read the current `app/src/components/templates/FormationEditorView.tsx` first (it hasn't changed since Task 3 of the earlier plan — the version below replaces it in full).

For **offense**: no more arm-a-role toolbar — the editor loads with all 11 default tokens (new formation) or the saved tokens (editing existing), clicking a token opens the Color & Label panel instead of just showing a delete button, and a Mirror button appears once the formation has been saved at least once.

For **defense/specialTeams**: completely unchanged — same arm-role-then-click-to-place flow, same delete button, no panel, no Mirror, no pre-population. (These units have no fixed positional convention like offense's LT/LG/C/RG/RT — Phase 1 doesn't invent one.)

Write `app/src/components/templates/FormationEditorView.tsx`:
```tsx
import { useState } from 'react'
import type { FillStyle, Formation, PlayerRole, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { createDefaultOffensePlayers } from '../../lib/formationDefaults'
import { mirrorFormation } from '../../lib/mirrorFormation'
import { AppShell } from '../layout/AppShell'
import { TrashIcon, MirrorIcon } from '../icons'
import { FormationCanvas } from './FormationCanvas'
import { ColorLabelPanel } from './ColorLabelPanel'
import { MirrorNameModal } from './MirrorNameModal'

interface FormationEditorViewProps {
  unit: Unit
  nav?: React.ReactNode
  formationId?: string
  onBack: () => void
}

const ROLE_OPTIONS: Record<Unit, { role: PlayerRole; label: string; prefix: string }[]> = {
  offense: [
    { role: 'qb', label: 'QB', prefix: 'QB' },
    { role: 'skill', label: 'Skill', prefix: 'S' },
    { role: 'lineman', label: 'Lineman', prefix: 'L' },
  ],
  defense: [{ role: 'defense', label: 'Defense', prefix: 'D' }],
  specialTeams: [{ role: 'specialTeams', label: 'Special Teams', prefix: 'ST' }],
}

const FIELD_WIDTH = 100

export function FormationEditorView({ unit, nav, formationId, onBack }: FormationEditorViewProps) {
  const { createFormation, updateFormation, getFormation } = usePlaybook()
  const existing = formationId ? getFormation(formationId) : undefined
  const isOffensePrePopulated = unit === 'offense'

  const [name, setName] = useState(existing?.name ?? 'New Formation')
  const [players, setPlayers] = useState<Formation['players']>(
    existing?.players ?? (isOffensePrePopulated ? createDefaultOffensePlayers() : []),
  )
  const [armedRole, setArmedRole] = useState<PlayerRole | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelError, setLabelError] = useState<string | null>(null)
  const [mirroring, setMirroring] = useState(false)

  const roleOptions = ROLE_OPTIONS[unit]
  const selectedPlayer = players.find((p) => p.id === selectedId) ?? null

  const addPlayer = (point: { x: number; y: number }) => {
    if (!armedRole) return
    const opt = roleOptions.find((r) => r.role === armedRole)!
    const count = players.filter((p) => p.role === armedRole).length
    setPlayers((prev) => [...prev, { id: crypto.randomUUID(), label: `${opt.prefix}${count + 1}`, role: armedRole, x: point.x, y: point.y }])
  }

  const movePlayer = (id: string, point: { x: number; y: number }) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, x: point.x, y: point.y } : p)))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setPlayers((prev) => prev.filter((p) => p.id !== selectedId))
    setSelectedId(null)
  }

  const renameSelected = (newLabel: string) => {
    if (!selectedId) return
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setLabelError(null)
      return
    }
    const duplicate = players.some((p) => p.id !== selectedId && p.label.trim().toLowerCase() === trimmed.toLowerCase())
    if (duplicate) {
      setLabelError(`"${trimmed}" is already used by another player.`)
      return
    }
    setLabelError(null)
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, label: trimmed } : p)))
  }

  const recolorSelected = (color: string) => {
    if (!selectedId) return
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, color } : p)))
  }

  const restyleSelected = (fillStyle: FillStyle) => {
    if (!selectedId) return
    setPlayers((prev) => prev.map((p) => (p.id === selectedId ? { ...p, fillStyle } : p)))
  }

  const handleSave = async () => {
    if (!name.trim() || players.length === 0) return
    setSaving(true)
    setError(null)
    try {
      if (existing) {
        await updateFormation({ ...existing, name: name.trim(), players })
      } else {
        await createFormation({ name: name.trim(), unit, players })
      }
      onBack()
    } catch {
      setError('Could not save this formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleMirrorConfirm = async (mirroredName: string) => {
    setMirroring(false)
    setSaving(true)
    setError(null)
    try {
      await createFormation({ name: mirroredName, unit, players: mirrorFormation(players, FIELD_WIDTH) })
      onBack()
    } catch {
      setError('Could not save the mirrored formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={existing ? existing.name : 'New Formation'} subtitle={unit} onBack={onBack} nav={nav}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-panel px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
        />
        {error && <span className="text-xs text-alert-red">{error}</span>}
        {existing && (
          <button
            onClick={() => setMirroring(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-standard bg-app-bg px-3 py-2 text-xs font-bold uppercase text-muted hover:text-text disabled:opacity-40"
          >
            <MirrorIcon width={16} height={16} /> Mirror
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || players.length === 0}
          className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {!isOffensePrePopulated && (
        <div className="flex items-center justify-center gap-2 border-b border-white/10 bg-panel px-4 py-2">
          {roleOptions.map((opt) => (
            <button
              key={opt.role}
              onClick={() => {
                setArmedRole(opt.role)
                setSelectedId(null)
              }}
              className={`rounded-standard px-3 py-1.5 text-xs font-bold uppercase ${
                armedRole === opt.role ? 'bg-accent-teal text-white' : 'bg-app-bg text-muted hover:text-text'
              }`}
            >
              + {opt.label}
            </button>
          ))}
          {selectedId && (
            <button onClick={deleteSelected} className="ml-2 rounded-standard p-1.5 text-alert-red hover:bg-hover" aria-label="Delete player">
              <TrashIcon width={16} height={16} />
            </button>
          )}
        </div>
      )}

      <div className="relative" style={{ height: `calc(100% - ${isOffensePrePopulated ? 60 : 116}px)` }}>
        <FormationCanvas
          players={players}
          selectedId={selectedId}
          armed={armedRole !== null}
          onAddPlayer={addPlayer}
          onSelectPlayer={(id) => {
            setSelectedId(id)
            setArmedRole(null)
            setLabelError(null)
          }}
          onMovePlayer={movePlayer}
        />
        {isOffensePrePopulated && selectedPlayer && (
          <ColorLabelPanel
            label={selectedPlayer.label}
            color={selectedPlayer.color ?? '#00746b'}
            fillStyle={selectedPlayer.fillStyle ?? 'outline'}
            error={labelError}
            onRename={renameSelected}
            onColorChange={recolorSelected}
            onFillStyleChange={restyleSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
        {mirroring && (
          <MirrorNameModal
            defaultName={`${name} (Mirrored)`}
            onConfirm={handleMirrorConfirm}
            onCancel={() => setMirroring(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `cd app && npm test`
Expected: all existing tests plus the 5 new `mirrorFormation` tests pass. This task adds no new automated tests itself — the formation editor's UI flow (pre-populated defaults, edit-existing, panel interactions, mirror) is covered by Task 8's manual verification, matching how the original add/select/drag interaction was verified.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/templates/FormationEditorView.tsx app/src/components/templates/FormationsGallery.tsx app/src/components/templates/TemplatesView.tsx
git commit -m "Wire pre-populated defaults, edit-existing, Color & Label panel, and Mirror into the formation editor"
```

---

### Task 8: Manual verification

No files change in this task — it's a checklist to run in the browser (see this repo's established pattern: dev server on port 5210, signed in against the real Supabase project).

- [ ] **Step 1: New offense formation shows all 11 defaults**

Playbook → Offense → Edit Formations → + New Formation. Confirm: X, LT, LG, C, RG, RT, Y on the line of scrimmage in that left-to-right order; F, Q, H, Z in the backfield; no "+ QB/Skill/Lineman" toolbar is shown.

- [ ] **Step 2: Field background shows labeled yard lines**

On the same screen, confirm 3 lines above and 3 below the LOS, each labeled "5", "10", or "15" near both the left and right edges, and the LOS itself is visually heavier than the yard lines.

- [ ] **Step 3: Color & Label panel works**

Click any token. Confirm the panel opens with that token's current label in the text input, a color palette, and 8 fill-style swatches. Rename it, pick a different color, pick a different fill style, and confirm the token on the field updates live for each. Click "Done" and confirm the panel closes.

- [ ] **Step 4: Duplicate label is rejected**

Click a token, rename it to match another existing token's exact label (e.g. rename "H" to "X"). Confirm an inline error appears and the rename is not applied (the token's label on the field doesn't change).

- [ ] **Step 5: Drag repositioning still works**

Drag a token to a new spot. Confirm it moves and no duplicate token is created (check nothing new appears at the drag's start or end point).

- [ ] **Step 6: Save, then edit the saved formation**

Name the formation and Save. From the gallery, click that formation's tile. Confirm it opens in the editor with all your customizations (positions, labels, colors, fill styles) intact, not reset to defaults.

- [ ] **Step 7: Legacy formation still opens and edits**

Click one of the original seeded formations (e.g. "I Right", which has fewer than 11 tokens and no `color`/`fillStyle` set). Confirm it opens without errors, tokens render with sensible default colors/outline style, and you can still rename/recolor/drag/save it.

- [ ] **Step 8: Mirror creates a new formation correctly**

Open a saved formation, drag a lineman or two out of their default left-to-right order, click Mirror, confirm/edit the suggested name, and confirm. Confirm: (a) you're returned to the gallery with a **new** tile present under the mirrored name, (b) the original formation is unchanged, (c) opening the new mirrored formation shows all positions flipped left-right, (d) the 5 lineman tokens still read LT, LG, C, RG, RT left to right, (e) skill/QB token labels are unchanged from before the mirror.

- [ ] **Step 9: Defense/special-teams formations are unaffected**

Switch to Defense (or Special Teams), open "+ New Formation". Confirm the old arm-a-role-then-click-to-place flow still works exactly as before — no pre-populated tokens, no Color & Label panel, no Mirror button.

- [ ] **Step 10: No console errors**

Check the browser console throughout the above steps for errors.

- [ ] **Step 11: Final full check**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run lint`
Expected: no type errors, all tests pass, no new lint warnings introduced by this plan's files.
