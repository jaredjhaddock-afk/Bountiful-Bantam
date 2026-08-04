# Football Coach App — Frontend Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the two standalone prototypes (`clones/playmaker-editor`, `clones/hudl-player`) into one app at `app/`, on one unified charcoal/teal design system, with a shared top-level nav switching between "Video Review" and "Playbook".

**Architecture:** Single Vite + React + TypeScript + Tailwind CSS v4 app. Playbook feature code ports over near-verbatim (it already uses the target teal token names). Video player feature code ports over with its Tailwind color classes mechanically renamed from the navy/blue system to the shared teal system. No backend in this plan — both features keep the same in-memory-only behavior they have today in their prototypes (see `docs/superpowers/specs/2026-08-04-football-coach-app-design.md` for why: Supabase needs the user's own project credentials, which is a follow-up plan).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Vitest + @testing-library/react for logic/unit tests.

---

## Scope Check

This plan covers one subsystem — the frontend merge. It does not cover Supabase/auth/persistence (a separate follow-up plan once the user has Supabase credentials) and does not cover Google Drive OAuth (already explicitly out of scope per the design spec).

## File Structure

```
app/
├── package.json, tsconfig*.json, vite.config.ts, postcss.config.js, index.html
├── vitest.config.ts                          # NEW — Vitest setup
├── src/
│   ├── main.tsx, App.tsx                     # NEW — top nav + page switch
│   ├── styles/globals.css                    # NEW — merged teal token set
│   ├── setupTests.ts                         # NEW — vitest + RTL setup
│   ├── types/
│   │   ├── play.ts                           # ported verbatim from playmaker-editor
│   │   └── video.ts                          # ported verbatim from hudl-player's player.ts
│   ├── lib/
│   │   ├── youtube.ts                        # ported verbatim
│   │   ├── youtube.test.ts                   # NEW
│   │   ├── useHoldScrub.ts                   # ported verbatim
│   │   ├── fieldMath.ts                      # NEW — extracted from ScrubBar for testability
│   │   └── fieldMath.test.ts                 # NEW
│   ├── state/
│   │   ├── playbookStore.tsx                 # ported verbatim
│   │   └── playbookStore.test.tsx             # NEW
│   ├── components/
│   │   ├── icons.tsx                          # NEW — merged icon set (playbook + player icons)
│   │   ├── layout/AppShell.tsx                # NEW — shared shell + top nav
│   │   ├── player/                            # ported + restyled
│   │   │   ├── VideoStage.tsx
│   │   │   ├── ScrubBar.tsx                   # restyled, uses fieldMath.ts
│   │   │   ├── ControlBar.tsx                 # restyled
│   │   │   ├── DrawingCanvas.tsx              # ported verbatim
│   │   │   └── VideoPlayerPage.tsx            # restyled, no outer AppShell (shared one used instead)
│   │   ├── source/VideoSourceModal.tsx        # restyled
│   │   ├── playbook/                          # ported verbatim (FilterTabs, FormationList, NewPlayModal, NewPlayTile, PlayCard, PlaybookListView, UnitTabs)
│   │   ├── editor/                            # ported verbatim (AnnotationsPanel, EditorToolbar, FieldCanvas, PlayerToken, PlayEditorView, RoutePath, RouteToolBar)
│   │   └── templates/                         # ported verbatim (FormationsGallery, RouteTreeGallery, TemplatesView)
│   └── pages/
│       ├── VideoReviewPage.tsx                # NEW — wraps VideoSourceModal/VideoPlayerPage in shared AppShell
│       └── PlaybookPage.tsx                   # NEW — wraps PlaybookListView/PlayEditorView/TemplatesView in shared AppShell
```

**Naming decision (locks in the color-token rename):** the merged app's Tailwind theme uses the **playmaker-editor** token names as the single source of truth, since we're adopting its charcoal/teal system. The video player's prototype used different names for the same concepts — those get renamed during the port:

| hudl-player prototype class | merged app class |
|---|---|
| `bg-app-bg` | `bg-app-bg` (unchanged — same hex too) |
| `bg-panel` | `bg-panel` (unchanged) |
| `bg-panel-2` | `bg-app-bg` (panel-2 doesn't exist in the merged set; nearest equivalent) |
| `bg-navy`, `bg-navy-2` | `bg-toolbar` |
| `text-text`, `text-text-bright` | `text-text` (merged set has one text color, not two) |
| `text-text-muted` | `text-muted` |
| `bg-accent-blue`, `text-accent-blue` | `bg-accent-teal`, `text-accent-teal` |
| `bg-scrub-fill` | `bg-scrub-fill` (unchanged — the one deliberately-kept non-teal color) |
| `rounded-standard` | `rounded-standard` (unchanged) |

---

### Task 1: Scaffold the merged app with the unified design system

**Files:**
- Create: `app/` (via `npm create vite@latest`)
- Create: `app/postcss.config.js`
- Create: `app/src/styles/globals.css`
- Modify: `app/index.html`

- [ ] **Step 1: Scaffold the Vite project**

Run:
```bash
mkdir -p ~/Projects/football-coach-app/app && cd ~/Projects/football-coach-app/app && npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```
Expected: `package.json`, `src/App.tsx`, etc. created; installs complete with 0 vulnerabilities.

- [ ] **Step 2: Add PostCSS config**

Write `app/postcss.config.js`:
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Write the merged design tokens**

Write `app/src/styles/globals.css` (this is the playmaker-editor token set — the app-wide standard per the design spec — with `--color-scrub-fill` added for the video player's timeline):
```css
@import "tailwindcss";

@theme {
  --color-app-bg: #161a1d;
  --color-panel: #1f272e;
  --color-panel-translucent: rgba(31, 39, 46, 0.4);
  --color-toolbar: #3a434d;
  --color-surface-2: #323b45;
  --color-muted: #5a6470;
  --color-text: #ffffff;
  --color-text-secondary: #d8d8d8;
  --color-hover: rgba(255, 255, 255, 0.07);
  --color-accent-teal: #00746b;
  --color-qb-red: #900203;
  --color-alert-red: #e50101;
  --color-lineman-gray: #4d4d4d;
  --color-lineman-blue: #6e7d8a;
  --color-scrub-fill: #e8720c;

  --radius-standard: 3px;

  --font-ui: "Barlow Condensed", Tahoma, sans-serif;
  --font-label: "Montserrat", Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--color-app-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: 16px;
}

button {
  font-family: inherit;
  color: inherit;
}
```

- [ ] **Step 4: Wire fonts and title into index.html**

Modify `app/index.html` — replace the `<head>` contents (keep `<meta charset>` and `<div id="root">`/script tag as scaffolded) with:
```html
<meta charset="UTF-8" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Football Coach App</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;700&family=Montserrat:wght@600&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 5: Verify Tailwind builds**

Delete the scaffolded `app/src/App.css` and `app/src/index.css` (unused — globals.css replaces them):
```bash
rm -f app/src/App.css app/src/index.css
```
Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no output (no errors). (App.tsx still references the deleted CSS at this point — that gets fixed in Task 6, so a build error here about `index.css`/`App.css` imports is expected and fine; the `tsc` type-check above doesn't check CSS imports, so it should still pass clean.)

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/postcss.config.js app/src/styles/globals.css app/index.html app/package.json app/package-lock.json app/tsconfig*.json app/vite.config.ts
git commit -m "Scaffold merged app with unified teal design tokens"
```

---

### Task 2: Vitest setup

**Files:**
- Create: `app/vitest.config.ts`
- Create: `app/src/setupTests.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Write vitest config**

Write `app/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
})
```

- [ ] **Step 2: Write test setup file**

Write `app/src/setupTests.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Add a test script**

Modify `app/package.json` — add to the `"scripts"` object:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify the test runner works with a throwaway test**

Write `app/src/sanity.test.ts` (temporary):
```ts
import { describe, expect, it } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```
Run: `cd app && npm test`
Expected: `1 passed`

- [ ] **Step 5: Delete the throwaway test and commit**

```bash
rm ~/Projects/football-coach-app/app/src/sanity.test.ts
cd ~/Projects/football-coach-app
git add app/vitest.config.ts app/src/setupTests.ts app/package.json app/package-lock.json
git commit -m "Add Vitest + React Testing Library setup"
```

---

### Task 3: Port shared types and icons

**Files:**
- Create: `app/src/types/play.ts`
- Create: `app/src/types/video.ts`
- Create: `app/src/components/icons.tsx`

- [ ] **Step 1: Copy the playbook types verbatim**

```bash
cp ~/Projects/football-coach-app/clones/playmaker-editor/src/types/play.ts ~/Projects/football-coach-app/app/src/types/play.ts
```

- [ ] **Step 2: Copy the video types, renamed**

```bash
cp ~/Projects/football-coach-app/clones/hudl-player/src/types/player.ts ~/Projects/football-coach-app/app/src/types/video.ts
```

- [ ] **Step 3: Merge the two icon sets into one file**

Write `app/src/components/icons.tsx` (union of `clones/playmaker-editor/src/components/icons.tsx` and `clones/hudl-player/src/components/icons.tsx` — both already export non-colliding names, so this is a concatenation):

```tsx
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (p: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

// --- Playbook editor icons ---
export const BackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)
export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
)
export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
)
export const FilmIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="1" />
    <path d="M8 5v14M16 5v14M3 10h5M16 10h5M3 15h5M16 15h5" />
  </svg>
)
export const NotesIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4h8M8 20h8M8 4v16M16 4v16" />
  </svg>
)
export const RouteIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 19L19 5" />
    <path d="M13 5h6v6" />
  </svg>
)
export const PersonnelIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="2.5" />
    <circle cx="17" cy="9" r="2" />
    <path d="M4 19c0-3 2.5-5 5-5s5 2 5 5M15 19c0-2.3 1.6-4 4-4" />
  </svg>
)
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none" />
  </svg>
)
export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.01" />
  </svg>
)
export const CloudIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 01-.5-7.97A5 5 0 0116.9 8.5 4.5 4.5 0 0117 18H7z" />
  </svg>
)
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const PrintIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="9" width="12" height="7" rx="1" />
    <path d="M6 9V4h12v5M8 16v4h8v-4" />
  </svg>
)
export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="7" cy="9" r="2.2" />
    <circle cx="16" cy="6" r="2.2" />
    <circle cx="16" cy="14" r="2.2" />
    <path d="M9 10l5-2.5M9 9.5l5 3.5" />
  </svg>
)
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9" />
  </svg>
)
export const NoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 6l12 12" />
  </svg>
)
export const SlidersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 17h16" />
    <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
  </svg>
)
export const MotionIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h9M11 8l3 4-3 4" />
    <path d="M5 8h4M5 16h4" opacity={0.5} />
  </svg>
)
export const StarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l2.3 5.1 5.6.5-4.2 3.7 1.3 5.5L12 15.9 6.9 18.8l1.3-5.5L4 9.6l5.6-.5z" />
  </svg>
)
export const SquiggleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 15c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0" />
  </svg>
)
export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)
export const UpArrowIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19V6M6 11l6-6 6 6" />
  </svg>
)
export const CurveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 18C6 10 12 10 18 6" />
  </svg>
)
export const ArrowAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 18L18 6" />
    <path d="M10 6h8v8" />
  </svg>
)
export const FootballAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="8" ry="5" />
    <path d="M6 12h12M9 9.5l1 5M15 9.5l-1 5" />
  </svg>
)
export const ConeAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l5 15H7z" />
    <path d="M9 14h6" />
  </svg>
)
export const CommentAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H9l-4 4z" />
  </svg>
)

// --- Video player icons ---
export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
  </svg>
)
export const SlowFwdIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 5l7 7-7 7z" fill="currentColor" stroke="none" opacity={0.55} />
    <text x="14" y="16" fontSize="7" fill="currentColor" stroke="none">
      .4x
    </text>
  </svg>
)
export const SlowRevIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 5l-7 7 7 7z" fill="currentColor" stroke="none" opacity={0.55} />
    <text x="2" y="16" fontSize="7" fill="currentColor" stroke="none">
      .4x
    </text>
  </svg>
)
export const FastFwdIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6l7 6-7 6z" fill="currentColor" stroke="none" />
    <path d="M13 6l7 6-7 6z" fill="currentColor" stroke="none" />
  </svg>
)
export const FastRevIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6l-7 6 7 6z" fill="currentColor" stroke="none" />
    <path d="M11 6l-7 6 7 6z" fill="currentColor" stroke="none" />
  </svg>
)
export const InIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4v16M8 12h11M15 8l4 4-4 4" />
  </svg>
)
export const OutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M16 4v16M16 12H5M9 8L5 12l4 4" />
  </svg>
)
export const LoopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12a8 8 0 0113-6M20 12a8 8 0 01-13 6" />
    <path d="M17 3v4h-4M7 21v-4h4" />
  </svg>
)
export const PencilIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />
  </svg>
)
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
  </svg>
)
export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
)
export const YoutubeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="3" />
    <path d="M10 9.5l6 2.5-6 2.5z" fill="currentColor" stroke="none" />
  </svg>
)
export const DriveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 3h8l6 10.5-4 6.5H6l-4-6.5z" />
    <path d="M8 3l6 10.5M18 20l-6-10.5" />
  </svg>
)
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: only errors about unused/missing consumers are fine at this stage if any — there should be **no syntax/type errors in the files just added**. If there are, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/types/play.ts app/src/types/video.ts app/src/components/icons.tsx
git commit -m "Port shared types and merged icon set into app/"
```

---

### Task 4: Port playbook feature (verbatim)

**Files:**
- Create: `app/src/state/playbookStore.tsx`
- Create: `app/src/state/playbookStore.test.tsx`
- Create: `app/src/components/layout/AppShell.tsx` (temporary — Task 6 replaces this with the shared shell; write it now so playbook components have their dependency, verbatim copy of the playmaker-editor version)
- Create: `app/src/components/playbook/*.tsx` (7 files)
- Create: `app/src/components/editor/*.tsx` (7 files)
- Create: `app/src/components/templates/*.tsx` (3 files)

- [ ] **Step 1: Copy the store and all playbook/editor/template components verbatim**

```bash
cd ~/Projects/football-coach-app
mkdir -p app/src/components/layout app/src/components/playbook app/src/components/editor app/src/components/templates
cp clones/playmaker-editor/src/state/playbookStore.tsx app/src/state/playbookStore.tsx
cp clones/playmaker-editor/src/components/layout/AppShell.tsx app/src/components/layout/AppShell.tsx
cp clones/playmaker-editor/src/components/playbook/*.tsx app/src/components/playbook/
cp clones/playmaker-editor/src/components/editor/*.tsx app/src/components/editor/
cp clones/playmaker-editor/src/components/templates/*.tsx app/src/components/templates/
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors from the copied files (import paths are unchanged — `../../types/play`, `../../state/playbookStore`, `../icons` all still resolve correctly at the same relative depth).

- [ ] **Step 3: Write a unit test for the playbook store's core logic**

This is the one piece of real logic in the playbook feature worth a dedicated test (formation lookup + play creation seeding routes as empty). Write `app/src/state/playbookStore.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PlaybookProvider, usePlaybook } from './playbookStore'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => <PlaybookProvider>{children}</PlaybookProvider>

describe('playbookStore', () => {
  it('seeds formationsForUnit with the built-in offensive formations', () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    const offense = result.current.formationsForUnit('offense')
    expect(offense.map((f) => f.id)).toEqual(['i-right', 'split-right', 'deuce', 'duo'])
  })

  it('createPlay seeds players from the chosen formation with empty routes', () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    let playId = ''
    act(() => {
      const play = result.current.createPlay({
        name: 'Test Play',
        unit: 'offense',
        formationId: 'i-right',
        categoryId: 'run',
        positionNotes: {},
      })
      playId = play.id
    })
    const play = result.current.plays.find((p) => p.id === playId)
    expect(play).toBeDefined()
    expect(play!.players).toHaveLength(11)
    expect(play!.players.every((p) => p.route.length === 0)).toBe(true)
  })

  it('updatePlay replaces the play with matching id', () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    let playId = ''
    act(() => {
      const play = result.current.createPlay({
        name: 'Test Play',
        unit: 'offense',
        formationId: 'i-right',
        categoryId: 'run',
        positionNotes: {},
      })
      playId = play.id
    })
    act(() => {
      const play = result.current.plays.find((p) => p.id === playId)!
      result.current.updatePlay({ ...play, name: 'Renamed' })
    })
    expect(result.current.plays.find((p) => p.id === playId)!.name).toBe('Renamed')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `cd app && npm test -- playbookStore`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/ app/src/components/layout/ app/src/components/playbook/ app/src/components/editor/ app/src/components/templates/
git commit -m "Port playbook feature into app/ with store unit tests"
```

---

### Task 5: Port video player feature, restyled to the teal system

**Files:**
- Create: `app/src/lib/youtube.ts`, `app/src/lib/youtube.test.ts`
- Create: `app/src/lib/useHoldScrub.ts`
- Create: `app/src/lib/fieldMath.ts`, `app/src/lib/fieldMath.test.ts`
- Create: `app/src/components/player/VideoStage.tsx`, `DrawingCanvas.tsx` (verbatim)
- Create: `app/src/components/player/ScrubBar.tsx`, `ControlBar.tsx` (restyled)
- Create: `app/src/components/player/VideoPlayerPage.tsx` (restyled, minus its own header — Task 6's shared AppShell replaces it)
- Create: `app/src/components/source/VideoSourceModal.tsx` (restyled)

- [ ] **Step 1: Copy the source-agnostic lib and components verbatim**

```bash
cd ~/Projects/football-coach-app
mkdir -p app/src/lib app/src/components/player app/src/components/source
cp clones/hudl-player/src/lib/youtube.ts app/src/lib/youtube.ts
cp clones/hudl-player/src/lib/useHoldScrub.ts app/src/lib/useHoldScrub.ts
cp clones/hudl-player/src/components/player/VideoStage.tsx app/src/components/player/VideoStage.tsx
cp clones/hudl-player/src/components/player/DrawingCanvas.tsx app/src/components/player/DrawingCanvas.tsx
```

Then fix the one import in `VideoStage.tsx` that points at the old types file — modify `app/src/components/player/VideoStage.tsx`, change:
```ts
import type { MediaController, VideoSource } from '../../types/player'
```
to:
```ts
import type { MediaController, VideoSource } from '../../types/video'
```

- [ ] **Step 2: Write a unit test for YouTube URL parsing**

Write `app/src/lib/youtube.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseYouTubeId } from './youtube'

describe('parseYouTubeId', () => {
  it('parses a standard watch URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses a youtu.be short URL', () => {
    expect(parseYouTubeId('https://youtu.be/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses an embed URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses a bare 11-character video id', () => {
    expect(parseYouTubeId('aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('returns null for an unparseable string', () => {
    expect(parseYouTubeId('not a url')).toBeNull()
  })
})
```
Run: `cd app && npm test -- youtube`
Expected: `5 passed`

- [ ] **Step 3: Extract scrub-bar math into a testable module**

The prototype's `ScrubBar.tsx` computed `pct()` and `timeFromClientX()` inline. Pull the pure math into `app/src/lib/fieldMath.ts`:
```ts
export function timeToPercent(time: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(100, Math.max(0, (time / duration) * 100))
}

export function percentToTime(ratio: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(1, Math.max(0, ratio)) * duration
}
```

- [ ] **Step 4: Write unit tests for the extracted math**

Write `app/src/lib/fieldMath.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { timeToPercent, percentToTime } from './fieldMath'

describe('timeToPercent', () => {
  it('converts a time to a percentage of duration', () => {
    expect(timeToPercent(30, 120)).toBe(25)
  })

  it('clamps below 0', () => {
    expect(timeToPercent(-5, 120)).toBe(0)
  })

  it('clamps above duration', () => {
    expect(timeToPercent(200, 120)).toBe(100)
  })

  it('returns 0 when duration is 0', () => {
    expect(timeToPercent(5, 0)).toBe(0)
  })
})

describe('percentToTime', () => {
  it('converts a 0-1 ratio to a time', () => {
    expect(percentToTime(0.25, 120)).toBe(30)
  })

  it('clamps below 0', () => {
    expect(percentToTime(-0.5, 120)).toBe(0)
  })

  it('clamps above 1', () => {
    expect(percentToTime(1.5, 120)).toBe(120)
  })
})
```
Run: `cd app && npm test -- fieldMath`
Expected: `7 passed`

- [ ] **Step 5: Port ScrubBar.tsx, restyled and using fieldMath.ts**

Write `app/src/components/player/ScrubBar.tsx`:
```tsx
import { useRef, useState } from 'react'
import { percentToTime, timeToPercent } from '../../lib/fieldMath'

interface ScrubBarProps {
  duration: number
  currentTime: number
  inPoint: number
  outPoint: number
  onSeek: (t: number) => void
  onSetIn: (t: number) => void
  onSetOut: (t: number) => void
}

type Drag = 'playhead' | 'in' | 'out' | null

export function ScrubBar({ duration, currentTime, inPoint, outPoint, onSeek, onSetIn, onSetOut }: ScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag>(null)

  const pct = (t: number) => timeToPercent(t, duration)
  const timeFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return percentToTime((clientX - rect.left) / rect.width, duration)
  }

  const handleMove = (clientX: number) => {
    const t = timeFromClientX(clientX)
    if (drag === 'in') onSetIn(Math.min(t, outPoint - 0.05))
    else if (drag === 'out') onSetOut(Math.max(t, inPoint + 0.05))
    else if (drag === 'playhead') onSeek(t)
  }

  return (
    <div
      className="relative flex h-6 items-center"
      onMouseMove={(e) => drag && handleMove(e.clientX)}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
      <div
        ref={trackRef}
        className="relative h-[3px] w-full cursor-pointer rounded-full bg-white/15"
        onClick={(e) => !drag && onSeek(timeFromClientX(e.clientX))}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-white/25"
          style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint) - pct(inPoint)}%` }}
        />
        <div
          className="absolute top-0 h-full rounded-full bg-scrub-fill"
          style={{ left: `${pct(inPoint)}%`, width: `${Math.max(0, pct(currentTime) - pct(inPoint))}%` }}
        />
        <button
          aria-label="Set in point"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('in')
          }}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent"
          style={{ left: `${pct(inPoint)}%` }}
        />
        <button
          aria-label="Set out point"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('out')
          }}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent"
          style={{ left: `${pct(outPoint)}%` }}
        />
        <button
          aria-label="Playhead"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('playhead')
          }}
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${pct(currentTime)}%` }}
        />
      </div>
    </div>
  )
}
```
(This is the same component as the prototype's `ScrubBar.tsx`, but `pct`/`timeFromClientX` now delegate to the tested `fieldMath.ts` functions instead of duplicating the clamp math inline. No `bg-navy`/`bg-accent-blue` classes were used in this file originally, so no color renames are needed here.)

- [ ] **Step 6: Port ControlBar.tsx with color classes renamed**

```bash
cp ~/Projects/football-coach-app/clones/hudl-player/src/components/player/ControlBar.tsx ~/Projects/football-coach-app/app/src/components/player/ControlBar.tsx
```
Then modify `app/src/components/player/ControlBar.tsx` — apply these exact replacements (every occurrence):
- `bg-accent-blue` → `bg-accent-teal`
- `active:bg-accent-blue/30` → `active:bg-accent-teal/30`
- `bg-accent-blue/20 text-accent-blue` → `bg-accent-teal/20 text-accent-teal`

There are 4 occurrences total (the play/pause button's background, the hold-button active state, and the two toggle-button active states for loop and draw). After editing, `grep -n "accent-blue" app/src/components/player/ControlBar.tsx` must return nothing.

- [ ] **Step 7: Port VideoPlayerPage.tsx, restyled and without its own header**

The prototype's `VideoPlayerPage.tsx` renders its own `<header>` with a "Change video" button — Task 6's shared `AppShell` will own the top nav instead, so that header is removed here (the "change video" action moves to `VideoReviewPage.tsx` in Task 6). Write `app/src/components/player/VideoPlayerPage.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaController, Stroke, VideoSource } from '../../types/video'
import { useHoldScrub } from '../../lib/useHoldScrub'
import { ControlBar } from './ControlBar'
import { DrawingCanvas } from './DrawingCanvas'
import { ScrubBar } from './ScrubBar'
import { VideoStage } from './VideoStage'

interface VideoPlayerPageProps {
  source: VideoSource
}

export function VideoPlayerPage({ source }: VideoPlayerPageProps) {
  const controllerRef = useRef<MediaController>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
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

  const togglePlay = () => {
    if (playing) controllerRef.current?.pause()
    else controllerRef.current?.play()
  }

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

  return (
    <div className="relative flex h-full flex-col">
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
          onSeek={(t) => {
            controllerRef.current?.seekTo(t)
            setCurrentTime(t)
          }}
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
        />
      </div>
    </div>
  )
}
```
Note: `penColor` changed from the prototype's orange (`#e8720c`, which matched the Hudl scrub-fill accent) to teal (`#00746b`, matching the merged app's accent) — the scrub-fill orange is now reserved solely for timeline progress per the design spec, so the default pen color shouldn't reuse it.

- [ ] **Step 8: Port VideoSourceModal.tsx with color classes renamed**

```bash
cp ~/Projects/football-coach-app/clones/hudl-player/src/components/source/VideoSourceModal.tsx ~/Projects/football-coach-app/app/src/components/source/VideoSourceModal.tsx
```
Then modify `app/src/components/source/VideoSourceModal.tsx` — apply these exact replacements (every occurrence):
- `import type { VideoSource } from '../../types/player'` → `import type { VideoSource } from '../../types/video'`
- `bg-navy text-text-bright` → `bg-toolbar text-text`
- `bg-panel-2` (3 occurrences: the tab strip background, the youtube URL input background, the textarea background) → `bg-app-bg`
- `focus:border-accent-blue` → `focus:border-accent-teal`
- `text-scrub-fill` (the error message color) → stays `text-scrub-fill` (no rename — this is intentionally the one non-teal warning color, reused from the kept `scrub-fill` token)
- `bg-accent-blue` (2 occurrences: "Load video" and "Choose file" buttons) → `bg-accent-teal`
- `text-text-bright` (the "Load game tape" heading) → `text-text`
- `text-text-muted` (all occurrences) → `text-muted`

After editing, `grep -nE "accent-blue|text-bright|text-navy|panel-2|/types/player" app/src/components/source/VideoSourceModal.tsx` must return nothing.

- [ ] **Step 9: Verify everything compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 10: Run the full test suite**

Run: `cd app && npm test`
Expected: `15 passed` (3 playbookStore + 5 youtube + 7 fieldMath).

- [ ] **Step 11: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/lib/ app/src/components/player/ app/src/components/source/
git commit -m "Port video player feature into app/, restyled to the teal design system"
```

---

### Task 6: Shared AppShell with top nav, and page wrappers

**Files:**
- Modify: `app/src/components/layout/AppShell.tsx`
- Create: `app/src/pages/VideoReviewPage.tsx`
- Create: `app/src/pages/PlaybookPage.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/main.tsx`

- [ ] **Step 1: Extend AppShell with a top-level nav switcher**

The copied `AppShell.tsx` (from Task 4) takes `title`/`subtitle`/`onBack`/`center`/`children` props, used as-is by the playbook feature's own sub-views (list/editor/templates each render their own `AppShell`). Add an **optional** nav prop so the same component can also show the app-wide "Video Review | Playbook" switcher at the very top, without breaking any existing caller (all existing call sites omit the new prop, so behavior for them is unchanged). Modify `app/src/components/layout/AppShell.tsx`:

Read the current file first, then change the props interface and header markup to:
```tsx
import type { ReactNode } from 'react'
import { BackIcon, CloudIcon, HelpIcon } from '../icons'

interface AppShellProps {
  title: ReactNode
  subtitle?: string
  onBack?: () => void
  center?: ReactNode
  nav?: ReactNode
  children: ReactNode
}

export function AppShell({ title, subtitle, onBack, center, nav, children }: AppShellProps) {
  return (
    <div className="flex h-full flex-col bg-app-bg text-text">
      {nav && <div className="border-b border-white/10 bg-app-bg px-4">{nav}</div>}
      <header className="flex items-center justify-between border-b border-white/10 bg-app-bg px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="rounded-standard p-1 hover:bg-hover" aria-label="Back">
              <BackIcon />
            </button>
          )}
          <div>
            {subtitle && <div className="text-xs uppercase tracking-wide text-muted">{subtitle}</div>}
            <div className="font-bold uppercase tracking-wide">{title}</div>
          </div>
        </div>
        {center && <div className="flex items-center gap-4">{center}</div>}
        <div className="flex items-center gap-3 text-muted">
          <HelpIcon />
          <CloudIcon />
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```
(Only the `nav` prop and the `{nav && ...}` line are new; everything else matches the ported file.)

- [ ] **Step 2: Write the nav switcher + page wrapper for video review**

Write `app/src/pages/VideoReviewPage.tsx`:
```tsx
import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import type { VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
}

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const [source, setSource] = useState<VideoSource | null>(null)

  return (
    <AppShell
      title="Video Review"
      nav={nav}
      onBack={source ? () => setSource(null) : undefined}
      subtitle={source?.fileName}
    >
      {source ? <VideoPlayerPage source={source} /> : <VideoSourceModal onSelect={setSource} />}
    </AppShell>
  )
}
```

- [ ] **Step 3: Write the page wrapper for playbook**

The playbook feature's own views (`PlaybookListView`, `PlayEditorView`, `TemplatesView`) each already render a full `AppShell` internally (ported verbatim in Task 4). Write `app/src/pages/PlaybookPage.tsx` as the same view-switching logic the prototype's `App.tsx` had, but forwarding the shared `nav` down to whichever child view is active — this requires each of those three view components to accept and forward a `nav` prop to their own internal `AppShell` call.

Modify `app/src/components/playbook/PlaybookListView.tsx` — the same two-part change applies to `app/src/components/editor/PlayEditorView.tsx` and `app/src/components/templates/TemplatesView.tsx`, using each file's own existing props interface and `AppShell` call:

Part 1 — add `nav` to the props interface. Change:
```tsx
interface PlaybookListViewProps {
  onOpenPlay: (id: string) => void
  onOpenTemplates: () => void
}
```
to:
```tsx
interface PlaybookListViewProps {
  nav?: React.ReactNode
  onOpenPlay: (id: string) => void
  onOpenTemplates: () => void
}
```
(For `PlayEditorViewProps`, add the same `nav?: React.ReactNode` line alongside its existing `playId`/`onBack`. For `TemplatesViewProps`, add it alongside its existing `onBack`.)

Part 2 — destructure it and pass it through. Change:
```tsx
export function PlaybookListView({ onOpenPlay, onOpenTemplates }: PlaybookListViewProps) {
```
to:
```tsx
export function PlaybookListView({ nav, onOpenPlay, onOpenTemplates }: PlaybookListViewProps) {
```
and change the component's existing `<AppShell title={...}>` opening tag to include `nav={nav}`, e.g.:
```tsx
<AppShell title={`${teamName} Playbooks`} nav={nav}>
```
(For `PlayEditorView`, its existing call is `<AppShell title={play.name} subtitle={formation?.name} onBack={onBack}>` — add `nav={nav}` to that same tag. For `TemplatesView`, its existing call is `<AppShell title="Offensive Templates" onBack={onBack}>` — add `nav={nav}` to that same tag.)

Then write `app/src/pages/PlaybookPage.tsx`:
```tsx
import { useState } from 'react'
import { PlayEditorView } from '../components/editor/PlayEditorView'
import { PlaybookListView } from '../components/playbook/PlaybookListView'
import { TemplatesView } from '../components/templates/TemplatesView'

type View = { name: 'list' } | { name: 'editor'; playId: string } | { name: 'templates' }

interface PlaybookPageProps {
  nav: React.ReactNode
}

export function PlaybookPage({ nav }: PlaybookPageProps) {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'editor') {
    return <PlayEditorView nav={nav} playId={view.playId} onBack={() => setView({ name: 'list' })} />
  }
  if (view.name === 'templates') {
    return <TemplatesView nav={nav} onBack={() => setView({ name: 'list' })} />
  }
  return (
    <PlaybookListView
      nav={nav}
      onOpenPlay={(playId) => setView({ name: 'editor', playId })}
      onOpenTemplates={() => setView({ name: 'templates' })}
    />
  )
}
```

- [ ] **Step 4: Write the top-level App.tsx with the nav switcher**

Write `app/src/App.tsx`:
```tsx
import { useState } from 'react'
import { PlaybookProvider } from './state/playbookStore'
import { VideoReviewPage } from './pages/VideoReviewPage'
import { PlaybookPage } from './pages/PlaybookPage'

type Section = 'video' | 'playbook'

function NavSwitcher({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  return (
    <div className="flex gap-6 py-2 text-sm font-bold uppercase tracking-wide">
      <button
        onClick={() => onChange('video')}
        className={section === 'video' ? 'text-accent-teal' : 'text-muted hover:text-text'}
      >
        Video Review
      </button>
      <button
        onClick={() => onChange('playbook')}
        className={section === 'playbook' ? 'text-accent-teal' : 'text-muted hover:text-text'}
      >
        Playbook
      </button>
    </div>
  )
}

function App() {
  const [section, setSection] = useState<Section>('video')
  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
    </PlaybookProvider>
  )
}

export default App
```

- [ ] **Step 5: Write main.tsx**

Write `app/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Delete the scaffolded assets and unused default files**

```bash
cd ~/Projects/football-coach-app/app
rm -rf src/assets
```

- [ ] **Step 7: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `cd app && npm test`
Expected: `15 passed`.

- [ ] **Step 9: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/layout/AppShell.tsx app/src/components/playbook/PlaybookListView.tsx app/src/components/editor/PlayEditorView.tsx app/src/components/templates/TemplatesView.tsx app/src/pages/ app/src/App.tsx app/src/main.tsx
git rm -r --cached app/src/assets 2>/dev/null || true
git commit -m "Add shared top-level nav and wire both features into one app"
```

---

### Task 7: Manual verification in browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd app && npm run dev -- --port 5195`
Expected: `VITE ... ready`, `Local: http://localhost:5195/`

- [ ] **Step 2: Verify Playbook feature end-to-end**

In a browser at `http://localhost:5195`:
1. Click "Playbook" in the top nav — the playbook list view loads, showing the unit tabs (○ ✕ ◇) and formation list, styled in charcoal/teal (not the old navy/blue).
2. Click "NEW OFFENSIVE PLAY", confirm the modal, and confirm the editor canvas opens with player tokens.
3. Select a player, draw a route by clicking the field, confirm it renders in teal.
4. Navigate back to the list — confirm the new play's thumbnail shows the drawn route.

Expected: matches the behavior already verified in `clones/playmaker-editor` during that prototype's own testing, now inside the merged app with the shared top nav visible above the playbook header.

- [ ] **Step 3: Verify Video Review feature end-to-end**

1. Click "Video Review" in the top nav.
2. Load a YouTube URL (e.g. `https://www.youtube.com/watch?v=aqz-KE-bpKQ`), confirm it renders styled in charcoal/teal (the play button, active toggle states, etc. should be teal, not blue).
3. Press play, then hold the fast-forward button — confirm the playhead advances and playback pauses on release.
4. Set an in point, fast-forward a few seconds, set an out point, enable loop, press play — confirm it plays forward and loops back to the in point without freezing (this exercises the loop-resume fix ported in Task 5).
5. Enable draw mode, draw a stroke over the video, confirm it renders, then clear it.

Expected: same verified behavior as the standalone `clones/hudl-player` prototype, now in teal instead of navy/blue, with the shared top nav visible.

- [ ] **Step 4: Check for console errors across both features**

While testing both flows above, check the browser console.
Expected: no errors.

- [ ] **Step 5: Stop the dev server**

No commit for this task — it's verification only. If any issue was found and fixed during this step, that fix should already have been committed as part of whichever task's file it touched; if it revealed a gap not covered by an earlier task, add a new commit now with a clear message describing the fix.

---

## Follow-up (not in this plan)

- Supabase backend: auth (email + team code), `teams`/`users`/`formations`/`categories`/`plays`/`clips` tables per the design spec, RLS policies. Blocked on the user creating a Supabase project and providing its URL + anon key.
- Google Drive picker integration (OAuth credentials required).
- Retiring `clones/playmaker-editor` and `clones/hudl-player` once `app/` is confirmed as the sole active codebase (keep them until then as working reference/fallback).
