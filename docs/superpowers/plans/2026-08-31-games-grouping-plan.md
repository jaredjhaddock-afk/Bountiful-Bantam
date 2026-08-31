# Games & Practices Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a coach group video clips under a "Game" (date + optional opponent + optional custom label), make Games the primary Video Review navigation (games list → that game's clips → player), auto-assign new clips to whichever game they were added from, and let a clip be moved to a different game (or "Unassigned") after the fact.

**Architecture:** A new `games` table + `GamesProvider`/`useGames()` context, mirroring `clipsStore.tsx`'s existing Context pattern exactly (a full team's games list is used in several places at once — the games list, the per-clip reassignment dropdown, the add-video flow — unlike bookmarks, which are deliberately a plain hook scoped to one clip at a time). `clips` gains a nullable `game_id`; moving a clip between games reuses the *existing* `updateClip` function (no new store method needed) since it's just another field on the same row. `VideoReviewPage`'s mode state machine grows a `games` step before `clips` (the renamed former `library` step).

**Tech Stack:** React, TypeScript, Vite, Tailwind v4, Vitest + React Testing Library, Supabase (RLS-only, migrations run manually by the user in the Supabase SQL Editor — never executed by the implementer).

---

## File Structure

```
supabase/migrations/0006_games.sql                     # NEW
app/src/lib/gameLabel.ts / .test.ts                      # NEW
app/src/state/gamesStore.mappers.ts                      # NEW
app/src/state/gamesStore.tsx / .test.tsx                 # NEW
app/src/state/clipsStore.mappers.ts                       # MODIFIED (Clip.gameId)
app/src/state/clipsStore.tsx                              # MODIFIED (createClip/findOrCreateFileClip gain gameId)
app/src/state/clipsStore.test.tsx                         # MODIFIED
app/src/components/icons.tsx                              # MODIFIED (+CalendarIcon)
app/src/components/source/NewGameModal.tsx                 # NEW
app/src/components/source/GamesLibrary.tsx                 # NEW
app/src/components/source/ClipLibrary.tsx                  # MODIFIED (gameId filter + move-to-game control)
app/src/pages/VideoReviewPage.tsx                          # MODIFIED (games/clips/add/player state machine)
app/src/App.tsx                                            # MODIFIED (+GamesProvider)
```

---

### Task 1: Migration and Clip type updates

**Files:**
- Create: `supabase/migrations/0006_games.sql`
- Modify: `app/src/state/clipsStore.mappers.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_games.sql`:

```sql
-- Adds a games table so clips can be grouped by game/practice, and browsing can be
-- game-first instead of one flat clip list. Run this once in the Supabase SQL Editor,
-- the same way 0001-0005 were run. Not executed by the app or by Claude — the
-- anon/publishable key has no schema-modification permission.

create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references profiles(id),
  date date not null,
  opponent text,
  name text,
  created_at timestamptz not null default now()
);

alter table games enable row level security;

create policy "team-scoped select games" on games for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert games" on games for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update games" on games for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete games" on games for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

-- Deleting a game un-assigns its clips (set null) rather than deleting them — a
-- coach's saved film and bookmarks are never destroyed by a game-management action.
alter table clips add column game_id uuid references games(id) on delete set null;
```

- [ ] **Step 2: Add `gameId` to the `Clip` type and mappers**

Read `app/src/state/clipsStore.mappers.ts` first. Replace it with:

```ts
import type { Stroke } from '../types/video'

export type ClipSourceType = 'youtube' | 'drive' | 'file'

export interface Clip {
  id: string
  sourceType: ClipSourceType
  sourceRef: string
  title: string | null
  inPoint: number | null
  outPoint: number | null
  drawingStrokes: Stroke[]
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
    game_id: clip.gameId,
  }
}
```

- [ ] **Step 3: Fix the now-broken existing test**

Read `app/src/state/clipsStore.mappers.test.ts` first. `Clip`/`ClipRow` now require `gameId`/`game_id` — update every literal object in that file to include it. Add `gameId: null` to the `clip` fixture object, `game_id: null` to both `row` fixture objects in the `describe('rowToClip', ...)` block, and add `game_id: null` to the expected output object in `clipToInsertRow`'s test.

- [ ] **Step 4: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors from `clipsStore.tsx`, `clipsStore.test.tsx`, `VideoPlayerPage.tsx`/`VideoReviewPage.tsx`/`ClipLibrary.tsx` callers not yet passing/handling `gameId` — expected at this point, fixed in later tasks. Confirm `app/src/state/clipsStore.mappers.ts` and `app/src/state/clipsStore.mappers.test.ts` themselves produce zero errors.

- [ ] **Step 5: Run the mapper test file to confirm it still passes**

Run: `cd app && npx vitest run src/state/clipsStore.mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/football-coach-app/.worktrees/games-grouping
git add supabase/migrations/0006_games.sql app/src/state/clipsStore.mappers.ts app/src/state/clipsStore.mappers.test.ts
git commit -m "Add games table migration and gameId to the Clip type"
```

---

### Task 2: Game display-label helper

**Files:**
- Create: `app/src/lib/gameLabel.ts`
- Test: `app/src/lib/gameLabel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/gameLabel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatGameDate, gameLabel } from './gameLabel'

describe('formatGameDate', () => {
  it('formats an ISO date as m/d', () => {
    expect(formatGameDate('2026-08-29')).toBe('8/29')
  })

  it('does not zero-pad', () => {
    expect(formatGameDate('2026-01-05')).toBe('1/5')
  })
})

describe('gameLabel', () => {
  it('shows date vs opponent when only opponent is set', () => {
    expect(gameLabel({ date: '2026-08-29', opponent: 'Corner Canyon', name: null })).toBe('8/29 vs Corner Canyon')
  })

  it('shows just the custom name when only name is set', () => {
    expect(gameLabel({ date: '2026-08-25', opponent: null, name: 'Tuesday walkthrough' })).toBe('Tuesday walkthrough')
  })

  it('shows just the date when neither is set', () => {
    expect(gameLabel({ date: '2026-08-25', opponent: null, name: null })).toBe('8/25')
  })

  it('prefers the custom name over the opponent when both are set', () => {
    expect(gameLabel({ date: '2026-08-29', opponent: 'Corner Canyon', name: 'Homecoming' })).toBe('Homecoming')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/gameLabel.test.ts`
Expected: FAIL — `Cannot find module './gameLabel'`

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/gameLabel.ts`:

```ts
export interface LabelableGame {
  date: string // ISO yyyy-mm-dd
  opponent: string | null
  name: string | null
}

export function formatGameDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}/${d}`
}

// A custom name, when set, is always the override — it's the coach's own label,
// chosen specifically to replace the auto-generated "date vs opponent" one (e.g. a
// practice with no opponent, or a game the coach wants labeled "Homecoming" instead).
export function gameLabel(game: LabelableGame): string {
  if (game.name) return game.name
  if (game.opponent) return `${formatGameDate(game.date)} vs ${game.opponent}`
  return formatGameDate(game.date)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/gameLabel.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/gameLabel.ts app/src/lib/gameLabel.test.ts
git commit -m "Add pure game-label formatting helper"
```

---

### Task 3: Games state (mappers + GamesProvider)

**Files:**
- Create: `app/src/state/gamesStore.mappers.ts`
- Create: `app/src/state/gamesStore.tsx`
- Test: `app/src/state/gamesStore.test.tsx`

Note: the design spec's "State management" section lists `updateGame` alongside
`createGame`/`deleteGame`. This plan deliberately drops it — nothing in this phase's UX
(no "edit a game" screen was designed; a wrong date/opponent/name is fixed by deleting
and recreating the game) ever calls it, and an exported-but-unused store method is
exactly the kind of dead code this codebase avoids elsewhere. If a future phase adds
game-editing, add it back then.

- [ ] **Step 1: Write the mappers**

Create `app/src/state/gamesStore.mappers.ts`:

```ts
export interface Game {
  id: string
  date: string
  opponent: string | null
  name: string | null
}

export interface GameRow {
  id: string
  date: string
  opponent: string | null
  name: string | null
}

export function rowToGame(row: GameRow): Game {
  return { id: row.id, date: row.date, opponent: row.opponent, name: row.name }
}

export function gameToInsertRow(game: Game, teamId: string) {
  return {
    id: game.id,
    team_id: teamId,
    date: game.date,
    opponent: game.opponent,
    name: game.name,
  }
}
```

- [ ] **Step 2: Write the failing tests for the provider**

Create `app/src/state/gamesStore.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { GamesProvider, useGames } from './gamesStore'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' } }),
}))

const GAME_ROWS = [
  { id: 'g1', date: '2026-08-22', opponent: 'Skyridge', name: null },
  { id: 'g2', date: '2026-08-29', opponent: 'Corner Canyon', name: null },
]

function makeGamesBuilder() {
  let eqId: string | null = null
  let deleted = false

  const builder = {
    select: () => ({ order: () => Promise.resolve({ data: GAME_ROWS, error: null }) }),
    eq: (_col: string, val: unknown) => {
      eqId = String(val)
      return builder
    },
    insert: () => Promise.resolve({ error: null }),
    delete: () => {
      deleted = true
      return builder
    },
    then: (onfulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
      const result = deleted ? { data: null, error: null } : { data: { id: eqId }, error: null }
      return Promise.resolve(result).then(onfulfilled)
    },
  }
  return builder
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'games') return makeGamesBuilder()
      return { select: () => Promise.resolve({ data: [], error: null }) }
    },
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <GamesProvider>{children}</GamesProvider>

describe('GamesProvider', () => {
  it('fetches games, newest date first', async () => {
    const { result } = renderHook(() => useGames(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.games.map((g) => g.id)).toEqual(['g2', 'g1'])
  })

  it('createGame adds a game to local state immediately, keeping newest-date-first order', async () => {
    const { result } = renderHook(() => useGames(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created: ReturnType<typeof result.current.createGame>
    act(() => {
      created = result.current.createGame({ date: '2026-09-05', opponent: 'Lone Peak' })
    })
    expect(created!.opponent).toBe('Lone Peak')
    expect(result.current.games[0].id).toBe(created!.id)
  })

  it('createGame defaults opponent and name to null when omitted', async () => {
    const { result } = renderHook(() => useGames(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created: ReturnType<typeof result.current.createGame>
    act(() => {
      created = result.current.createGame({ date: '2026-08-25', name: 'Walkthrough' })
    })
    expect(created!.opponent).toBeNull()
  })

  it('deleteGame removes the game from local state', async () => {
    const { result } = renderHook(() => useGames(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteGame('g1')
    })
    expect(result.current.games.map((g) => g.id)).toEqual(['g2'])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npx vitest run src/state/gamesStore.test.tsx`
Expected: FAIL — `Cannot find module './gamesStore'`

- [ ] **Step 4: Write the provider**

Create `app/src/state/gamesStore.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { gameToInsertRow, rowToGame, type Game } from './gamesStore.mappers'

export type { Game } from './gamesStore.mappers'

interface GamesContextValue {
  loading: boolean
  games: Game[]
  createGame: (input: { date: string; opponent?: string | null; name?: string | null }) => Game
  deleteGame: (id: string) => Promise<void>
}

const GamesContext = createContext<GamesContextValue | null>(null)

const byDateDesc = (a: Game, b: Game) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

export function GamesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('games')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        if (data) setGames(data.map(rowToGame))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const createGame: GamesContextValue['createGame'] = useCallback(
    ({ date, opponent, name }) => {
      const game: Game = { id: crypto.randomUUID(), date, opponent: opponent ?? null, name: name ?? null }
      setGames((prev) => [...prev, game].sort(byDateDesc))
      if (teamId) {
        supabase
          .from('games')
          .insert(gameToInsertRow(game, teamId))
          .then(({ error }) => {
            if (error) console.error('Failed to persist new game', error)
          })
      }
      return game
    },
    [teamId],
  )

  const deleteGame: GamesContextValue['deleteGame'] = useCallback(async (id: string) => {
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) throw error
    setGames((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const value = useMemo<GamesContextValue>(
    () => ({ loading, games, createGame, deleteGame }),
    [loading, games, createGame, deleteGame],
  )

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>
}

export function useGames() {
  const ctx = useContext(GamesContext)
  if (!ctx) throw new Error('useGames must be used within GamesProvider')
  return ctx
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run src/state/gamesStore.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Verify types and full suite**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: same known-intermediate errors as Task 1 (nothing new from these two files).

- [ ] **Step 7: Commit**

```bash
git add app/src/state/gamesStore.mappers.ts app/src/state/gamesStore.tsx app/src/state/gamesStore.test.tsx
git commit -m "Add GamesProvider and useGames hook"
```

---

### Task 4: Thread gameId through clipsStore

**Files:**
- Modify: `app/src/state/clipsStore.tsx`
- Modify: `app/src/state/clipsStore.test.tsx`

- [ ] **Step 1: Update `clipsStore.tsx`**

Read `app/src/state/clipsStore.tsx` first. Replace it with:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { clipToInsertRow, clipToUpdateRow, rowToClip, type Clip, type ClipSourceType } from './clipsStore.mappers'

export type { Clip } from './clipsStore.mappers'

interface ClipsContextValue {
  loading: boolean
  clips: Clip[]
  createClip: (input: { sourceType: ClipSourceType; sourceRef: string; title?: string | null; gameId?: string | null }) => Clip
  updateClip: (clip: Clip) => void
  findOrCreateFileClip: (fingerprint: string, fileName: string, gameId?: string | null) => Clip
}

const ClipsContext = createContext<ClipsContextValue | null>(null)

export function ClipsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('clips')
      .select('*')
      .order('created_at')
      .then(({ data }) => {
        if (cancelled) return
        if (data) setClips(data.map(rowToClip))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const createClip: ClipsContextValue['createClip'] = useCallback(
    ({ sourceType, sourceRef, title, gameId }) => {
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
      setClips((prev) => [...prev, clip])
      if (teamId) {
        supabase
          .from('clips')
          .insert(clipToInsertRow(clip, teamId))
          .then(({ error }) => {
            if (error) console.error('Failed to persist new clip', error)
          })
      }
      return clip
    },
    [teamId],
  )

  const pendingFileClipsRef = useRef<Map<string, Clip>>(new Map())

  const findOrCreateFileClip: ClipsContextValue['findOrCreateFileClip'] = useCallback(
    (fingerprint, fileName, gameId) => {
      const existing = clips.find((c) => c.sourceType === 'file' && c.sourceRef === fingerprint)
      if (existing) return existing
      const pending = pendingFileClipsRef.current.get(fingerprint)
      if (pending) return pending
      const created = createClip({ sourceType: 'file', sourceRef: fingerprint, title: fileName, gameId })
      pendingFileClipsRef.current.set(fingerprint, created)
      return created
    },
    [clips, createClip],
  )

  const updateClip: ClipsContextValue['updateClip'] = useCallback((clip: Clip) => {
    setClips((prev) => prev.map((c) => (c.id === clip.id ? clip : c)))
    supabase
      .from('clips')
      .update(clipToUpdateRow(clip))
      .eq('id', clip.id)
      .then(({ error }) => {
        if (error) console.error('Failed to persist clip update', error)
      })
  }, [])

  const value = useMemo<ClipsContextValue>(
    () => ({ loading, clips, createClip, updateClip, findOrCreateFileClip }),
    [loading, clips, createClip, updateClip, findOrCreateFileClip],
  )

  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>
}

export function useClips() {
  const ctx = useContext(ClipsContext)
  if (!ctx) throw new Error('useClips must be used within ClipsProvider')
  return ctx
}
```

(Only change from the current file: `createClip` and `findOrCreateFileClip` both gain an optional `gameId` parameter, threaded through to the created `Clip`. "Moving a clip to a different game" deliberately reuses the existing `updateClip` — a clip's `gameId` is just another field on the row, exactly like `title`, so no new store method is needed; that reassignment gets wired directly in `ClipLibrary` in Task 8.)

- [ ] **Step 2: Update the existing test file for the new `gameId` field/params**

Read `app/src/state/clipsStore.test.tsx` first. `EXISTING_FILE_CLIP` needs `game_id: null` added. Add these two new test cases to the `describe('findOrCreateFileClip', ...)` block:

```ts
  it('assigns the gameId to a newly created clip', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created
    act(() => {
      created = result.current.findOrCreateFileClip('newfile.mp4:12345', 'newfile.mp4', 'game-1')
    })
    expect(created!.gameId).toBe('game-1')
  })

  it('defaults gameId to null when not provided', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created
    act(() => {
      created = result.current.findOrCreateFileClip('another.mp4:999', 'another.mp4')
    })
    expect(created!.gameId).toBeNull()
  })
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd app && npx vitest run src/state/clipsStore.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 4: Verify types and full suite**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors remain only in `VideoPlayerPage.tsx`/`VideoReviewPage.tsx`/`ClipLibrary.tsx`/`App.tsx` (not yet touched) — nothing from `clipsStore.tsx` or its test file.

- [ ] **Step 5: Commit**

```bash
git add app/src/state/clipsStore.tsx app/src/state/clipsStore.test.tsx
git commit -m "Thread gameId through createClip and findOrCreateFileClip"
```

---

### Task 5: Calendar icon

**Files:**
- Modify: `app/src/components/icons.tsx`

- [ ] **Step 1: Add the icon**

Read `app/src/components/icons.tsx` first, and add this export at the end of the file:

```tsx
export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
)
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/icons.tsx
git commit -m "Add CalendarIcon"
```

---

### Task 6: NewGameModal

**Files:**
- Create: `app/src/components/source/NewGameModal.tsx`

- [ ] **Step 1: Write the component**

Create `app/src/components/source/NewGameModal.tsx`:

```tsx
import { useState } from 'react'
import { useGames, type Game } from '../../state/gamesStore'
import { CheckIcon, NoIcon } from '../icons'

interface NewGameModalProps {
  onClose: () => void
  onCreated: (game: Game) => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NewGameModal({ onClose, onCreated }: NewGameModalProps) {
  const { createGame } = useGames()
  const [date, setDate] = useState(todayIso())
  const [opponent, setOpponent] = useState('')
  const [name, setName] = useState('')

  const handleConfirm = () => {
    const game = createGame({ date, opponent: opponent.trim() || null, name: name.trim() || null })
    onCreated(game)
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">New Game</span>
          <button onClick={handleConfirm} className="text-accent-teal" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Opponent (optional)</div>
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Corner Canyon"
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Label (optional)</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tuesday walkthrough"
              className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

(Mirrors the established `NewCategoryModal.tsx`/`NewPlayModal.tsx` header pattern: a cancel/confirm icon pair flanking a title, no separate Save button.)

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file (it has no consumers yet — that's Task 7).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/NewGameModal.tsx
git commit -m "Add NewGameModal"
```

---

### Task 7: GamesLibrary

**Files:**
- Create: `app/src/components/source/GamesLibrary.tsx`

- [ ] **Step 1: Write the component**

Create `app/src/components/source/GamesLibrary.tsx`:

```tsx
import { useState } from 'react'
import { useGames, type Game } from '../../state/gamesStore'
import { useClips } from '../../state/clipsStore'
import { gameLabel } from '../../lib/gameLabel'
import { CalendarIcon, PlusIcon, TrashIcon } from '../icons'
import { DeleteConfirmModal } from '../playbook/DeleteConfirmModal'
import { NewGameModal } from './NewGameModal'

interface GamesLibraryProps {
  onOpenGame: (gameId: string | null) => void
}

export function GamesLibrary({ onOpenGame }: GamesLibraryProps) {
  const { loading, games, deleteGame } = useGames()
  const { clips } = useClips()
  const [addingGame, setAddingGame] = useState(false)
  const [deleting, setDeleting] = useState<Game | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Clips are already loaded in full by ClipsProvider (used across the whole Video
  // Review flow at once), so counting per game here is a plain client-side reduce —
  // no extra query needed, unlike bookmark counts which come from a table this
  // component doesn't otherwise load.
  const clipCount = (gameId: string | null) => clips.filter((c) => c.gameId === gameId).length

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteGame(deleting.id)
      setDeleting(null)
    } catch {
      setDeleteError('Could not delete this game. Try again.')
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setAddingGame(true)}
          disabled={loading}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add game</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading games…</p>}
        {games.map((game) => (
          <div
            key={game.id}
            className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
          >
            <button onClick={() => onOpenGame(game.id)} className="flex flex-1 flex-col justify-between text-left text-muted hover:text-text">
              <div className="flex items-center justify-between">
                <CalendarIcon width={16} height={16} />
                <span className="text-[10px]">{clipCount(game.id)} clip{clipCount(game.id) === 1 ? '' : 's'}</span>
              </div>
              <div className="truncate text-sm text-text">{gameLabel(game)}</div>
            </button>
            <button
              onClick={() => {
                setDeleting(game)
                setDeleteError(null)
              }}
              aria-label="Delete game"
              className="self-end text-muted hover:text-alert-red"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onOpenGame(null)}
          className="flex h-32 w-56 flex-col justify-center gap-1 rounded-standard border border-white/10 bg-panel p-3 text-left text-muted hover:border-accent-teal hover:text-text"
        >
          <span className="text-sm text-text">Unassigned</span>
          <span className="text-[10px] uppercase">
            {clipCount(null)} clip{clipCount(null) === 1 ? '' : 's'} not in a game
          </span>
        </button>
      </div>
      {addingGame && (
        <NewGameModal
          onClose={() => setAddingGame(false)}
          onCreated={(game) => {
            setAddingGame(false)
            onOpenGame(game.id)
          }}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          itemName={gameLabel(deleting)}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null)
            setDeleteError(null)
          }}
        />
      )}
    </div>
  )
}
```

(The "Unassigned" card is always last, after the date-sorted real games, and calls `onOpenGame(null)` — `null` is how the rest of this feature spells "the Unassigned bucket," matching a clip's `gameId: null`.)

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file (it has no consumers yet — that's Task 9).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/GamesLibrary.tsx
git commit -m "Add GamesLibrary: list, create, and delete games"
```

---

### Task 8: gameId filtering and move-to-game control in ClipLibrary

**Files:**
- Modify: `app/src/components/source/ClipLibrary.tsx`

- [ ] **Step 1: Rewrite the file**

Read `app/src/components/source/ClipLibrary.tsx` first. Replace it with:

```tsx
import { useClips, type Clip } from '../../state/clipsStore'
import { useGames } from '../../state/gamesStore'
import { useBookmarkCountsByClip } from '../../state/bookmarksStore'
import { gameLabel } from '../../lib/gameLabel'
import { BookmarkIcon, DriveIcon, FileIcon, PlusIcon, YoutubeIcon } from '../icons'

interface ClipLibraryProps {
  gameId: string | null
  onOpenClip: (clip: Clip) => void
  onAddNew: () => void
}

const SOURCE_ICONS = { youtube: YoutubeIcon, drive: DriveIcon, file: FileIcon } as const

export function ClipLibrary({ gameId, onOpenClip, onAddNew }: ClipLibraryProps) {
  const { loading, clips, updateClip } = useClips()
  const { games } = useGames()
  const bookmarkCounts = useBookmarkCountsByClip()
  const clipsInGame = clips.filter((c) => c.gameId === gameId)

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={onAddNew}
          disabled={loading}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add video</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading clips…</p>}
        {clipsInGame.map((clip) => {
          const Icon = SOURCE_ICONS[clip.sourceType]
          const count = bookmarkCounts[clip.id] ?? 0
          return (
            <div
              key={clip.id}
              className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
            >
              <button onClick={() => onOpenClip(clip)} className="flex flex-1 flex-col justify-between text-left">
                <div className="flex items-center justify-between text-muted">
                  <div className="flex items-center gap-2">
                    <Icon width={16} height={16} />
                    <span className="text-[10px] uppercase">{clip.sourceType === 'file' ? 'Select to play' : clip.sourceType}</span>
                  </div>
                  {count > 0 && (
                    <span className="flex items-center gap-1 text-[10px]">
                      <BookmarkIcon width={12} height={12} /> {count}
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-text">{clip.title || clip.sourceRef}</div>
              </button>
              <select
                value={clip.gameId ?? ''}
                onChange={(e) => updateClip({ ...clip, gameId: e.target.value || null })}
                className="mt-2 w-full rounded-standard bg-app-bg px-1.5 py-1 text-[10px] text-muted outline-none"
                aria-label="Move to a different game"
              >
                <option value="">Unassigned</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {gameLabel(g)}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

(The card's open-button and the "move to a different game" `<select>` are siblings, not nested — a `<select>` inside a `<button>` would be invalid HTML and would also make the select unusable, since clicking it would also trigger the button.)

- [ ] **Step 2: Verify the whole app compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors remain only in `VideoReviewPage.tsx` and `App.tsx` (not yet touched — `VideoReviewPage.tsx` doesn't pass `ClipLibrary` a `gameId` prop yet, and doesn't wrap the app in `GamesProvider` yet, so `useGames()` would throw at runtime even though it compiles). Nothing from `ClipLibrary.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/ClipLibrary.tsx
git commit -m "Filter ClipLibrary by game and add a move-to-game control per clip"
```

---

### Task 9: Wire the games/clips/add/player state machine into VideoReviewPage

**Files:**
- Modify: `app/src/pages/VideoReviewPage.tsx`

- [ ] **Step 1: Rewrite the file**

Read `app/src/pages/VideoReviewPage.tsx` first. Replace it with:

```tsx
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

type Mode = 'games' | 'clips' | 'add' | 'player'

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const { createClip, updateClip, findOrCreateFileClip } = useClips()
  const { games } = useGames()
  const [mode, setMode] = useState<Mode>('games')
  // Meaningful only while mode !== 'games': null means the "Unassigned" bucket.
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [source, setSource] = useState<VideoSource | null>(null)
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const { bookmarks, createBookmark, updateBookmarkNote, deleteBookmark } = useClipBookmarks(activeClip?.id ?? null)

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null

  const handleOpenGame = (gameId: string | null) => {
    setSelectedGameId(gameId)
    setMode('clips')
  }

  const handleNewSource = (newSource: VideoSource) => {
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors remain only in `App.tsx` (not yet wrapped in `GamesProvider` — `useGames()` calls in `VideoReviewPage`/`ClipLibrary`/`GamesLibrary` would throw at runtime without it, though this alone is not a *type* error). Confirm there are no actual `tsc` errors reported anywhere at this point — `App.tsx` not providing the context is a runtime concern, fixed in Task 10, not something `tsc` catches.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/VideoReviewPage.tsx
git commit -m "Add games list as the Video Review entry point, with clips nested under a game"
```

---

### Task 10: Mount GamesProvider

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Add the provider**

Read `app/src/App.tsx` first. Add the import:

```tsx
import { GamesProvider } from './state/gamesStore'
```

Wrap `ClipsProvider` around `GamesProvider` (order doesn't matter functionally — neither reads from the other — but nesting `GamesProvider` inside `ClipsProvider` keeps the two video-review-specific providers grouped together) in `AuthenticatedApp`:

```tsx
function AuthenticatedApp() {
  const [section, setSection] = useState<Section>('video')
  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      <ClipsProvider>
        <GamesProvider>
          {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
        </GamesProvider>
      </ClipsProvider>
    </PlaybookProvider>
  )
}
```

- [ ] **Step 2: Verify the whole app compiles and tests pass**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: a full clean compile, zero errors; all tests pass.

- [ ] **Step 3: Run lint**

Run: `cd app && npx oxlint`
Expected: no new warnings introduced by this plan's files.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx
git commit -m "Mount GamesProvider"
```

---

### Task 11: Manual verification

No files change in this task — a checklist to run in the browser against the real Supabase project (dev server, signed in), after running the Task 1 migration in the Supabase SQL Editor.

- [ ] **Step 1: Migration ran cleanly**

Confirm in the Supabase dashboard's Table Editor that a `games` table exists with the expected columns, and `clips` now has a `game_id` column.

- [ ] **Step 2: Existing clips land in "Unassigned"**

Open Video Review. Confirm the games list appears (not the old flat clip grid) with an "Unassigned" card, and that clicking it shows every clip that existed before this feature shipped.

- [ ] **Step 3: Create a game**

Click "+ Add Game," fill in a date and opponent, confirm. Confirm it opens directly into that (empty) game's clip view, and the game now appears in the games list with the right label.

- [ ] **Step 4: Adding a clip from inside a game assigns it**

From inside that game, "+ Add Video" a YouTube link. Confirm the clip appears in that game's list (not in "Unassigned") after going back.

- [ ] **Step 5: Practice with no opponent**

Create a second game with a date and a Label but no opponent. Confirm its card shows the label, not "date vs undefined" or similar.

- [ ] **Step 6: Move a clip to a different game**

From a clip's card, use the "move to a different game" control to move it to the second game (or to "Unassigned"). Confirm it disappears from the original game's list and appears in the new one after reload.

- [ ] **Step 7: Back navigation**

From inside a game's clip player, back out — confirm it lands on that game's clip list, not the games list. From the clip list, back out again — confirm it lands on the games list.

- [ ] **Step 8: Delete a game**

Delete a game that has clips assigned to it. Confirm the confirm dialog, confirm those clips are NOT deleted — they should reappear in "Unassigned" after the game is gone.

- [ ] **Step 9: Bookmarks still work unchanged**

Open a clip inside a game, add a bookmark with a note, reload, confirm it's still there — this feature shouldn't have touched anything about how bookmarks work.

- [ ] **Step 10: No console errors**

Check the browser console throughout the above steps.

- [ ] **Step 11: Final full check**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test && npx oxlint`
Expected: no type errors, all tests pass, no new lint warnings introduced by this plan's files.
