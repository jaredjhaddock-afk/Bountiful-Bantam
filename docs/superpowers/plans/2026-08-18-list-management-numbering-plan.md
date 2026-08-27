# List Management & Play Numbering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete and drag-to-reorder for formations and plays, and give every play a persistent, coach-editable number, replacing the current fake "position in the filtered grid" badge.

**Architecture:** Two new database columns (`sort_order` on formations/plays, `number` on plays) back everything. A new pure, unit-tested module (`listOrdering.ts`) holds the three tricky bits of logic (next-number assignment, duplicate-number detection, reorder-list computation) so they're verified without touching React or Supabase — mirroring how `mirrorFormation.ts` was kept separate in the prior phase. Drag-and-drop uses `@dnd-kit/core` + `@dnd-kit/sortable` rather than hand-rolling grid reordering. A shared `DeleteConfirmModal` handles both the plain "are you sure" case and formations' "blocked, here's what's using it" case.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (new dependencies), existing Supabase-backed `playbookStore`, Vitest.

---

## Prerequisite (not a task — user action)

Before Task 8 (manual verification) can succeed, run `supabase/migrations/0004_list_management_and_numbering.sql` (written in Task 1) in the Supabase SQL Editor, the same way 0001-0003 were run. This can happen any time before Task 8; it doesn't block Tasks 1-7 (those only touch application code, except that Task 4's store changes assume the new columns exist once the app actually talks to a real Supabase project — the automated tests in Tasks 1-7 all use the existing mocked-Supabase test pattern and don't need the real migration to pass).

## Scope Check

This plan covers delete + reorder + numbering for formations and plays only. Categories are explicitly out of scope (not requested). Print output, route drawing, the field canvas redesign, and the play editor toolbar are separate, later phases.

## File Structure

```
supabase/
└── migrations/
    └── 0004_list_management_and_numbering.sql   # NEW — written, not executed, by this plan
app/
├── package.json                                  # MODIFIED — + @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
├── src/
│   ├── types/play.ts                             # MODIFIED — Formation.sortOrder, Play.sortOrder + Play.number
│   ├── lib/
│   │   ├── listOrdering.ts                       # NEW — nextPlayNumber, isNumberTaken, reorderIds
│   │   └── listOrdering.test.ts                  # NEW
│   ├── state/
│   │   ├── playbookStore.mappers.ts              # MODIFIED — sort_order/number in row types + mappers
│   │   ├── playbookStore.mappers.test.ts         # MODIFIED
│   │   ├── playbookStore.tsx                     # MODIFIED — deleteFormation, deletePlay, reorderFormations, reorderPlays, number/sortOrder assignment on create, order-by-sort_order fetch
│   │   └── playbookStore.test.tsx                # MODIFIED
│   └── components/
│       ├── icons.tsx                             # MODIFIED — + GripIcon
│       ├── playbook/
│       │   ├── DeleteConfirmModal.tsx            # NEW
│       │   ├── PlayCard.tsx                      # MODIFIED — drag handle, delete, editable number badge
│       │   └── PlaybookListView.tsx              # MODIFIED — DndContext/SortableContext wiring
│       └── templates/
│           └── FormationsGallery.tsx             # MODIFIED — drag handle, delete, DndContext/SortableContext wiring
```

---

### Task 1: Migration and type additions

**Files:**
- Create: `supabase/migrations/0004_list_management_and_numbering.sql`
- Modify: `app/src/types/play.ts`

- [ ] **Step 1: Write the migration (do not run it)**

Write `supabase/migrations/0004_list_management_and_numbering.sql`:
```sql
-- Adds sort order (formations, plays) and a persistent, coach-editable play number.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run),
-- the same way 0001-0003 were run. Not executed by the app or by Claude — the anon/publishable
-- key has no schema-modification permission, and the backfill below needs the dashboard
-- session's elevated access to run against existing rows.

alter table formations add column sort_order integer not null default 0;
alter table plays add column sort_order integer not null default 0;
alter table plays add column number integer not null default 0;

-- Backfill existing rows so nothing visually reorders and every existing play ends up with a
-- real, distinct number instead of the placeholder 0 the column default above leaves it at.
-- Both follow each row's existing created_at order, scoped per team+unit (matching this
-- phase's "one global order per unit" and "numbers are per unit" decisions).
with ranked_formations as (
  select id, row_number() over (partition by team_id, unit order by created_at) - 1 as rn
  from formations
)
update formations set sort_order = ranked_formations.rn
from ranked_formations
where formations.id = ranked_formations.id;

with ranked_plays as (
  select id, row_number() over (partition by team_id, unit order by created_at) - 1 as rn
  from plays
)
update plays set sort_order = ranked_plays.rn, number = ranked_plays.rn + 1
from ranked_plays
where plays.id = ranked_plays.id;
```

- [ ] **Step 2: Add the new fields to the app's types**

Read the current `app/src/types/play.ts` first. Modify the `Formation` interface (currently):
```ts
export interface Formation {
  id: string
  name: string
  unit: Unit
  players: Omit<PlayerToken, 'route' | 'routeStyle'>[]
}
```
to add `sortOrder`:
```ts
export interface Formation {
  id: string
  name: string
  unit: Unit
  players: Omit<PlayerToken, 'route' | 'routeStyle'>[]
  sortOrder: number
}
```

Modify the `Play` interface (currently):
```ts
export interface Play {
  id: string
  name: string
  unit: Unit
  formationId: string
  categoryId: string
  players: PlayerToken[]
  annotations: Annotation[]
  positionNotes: Record<string, string>
}
```
to add `sortOrder` and `number`:
```ts
export interface Play {
  id: string
  name: string
  unit: Unit
  formationId: string
  categoryId: string
  players: PlayerToken[]
  annotations: Annotation[]
  positionNotes: Record<string, string>
  sortOrder: number
  number: number
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: **errors** — this is expected at this point, since nothing that constructs a `Formation`/`Play` object yet supplies `sortOrder`/`number` (that's fixed in Task 4). Confirm the errors are only about missing `sortOrder`/`number` properties (in `playbookStore.tsx` and `playbookStore.test.tsx`), not something else. Do not fix them in this task — Task 4 fixes the store, and mapper-related ones are fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add supabase/migrations/0004_list_management_and_numbering.sql app/src/types/play.ts
git commit -m "Add sort_order/number columns and corresponding app types"
```

---

### Task 2: Pure list-ordering helpers

**Files:**
- Create: `app/src/lib/listOrdering.ts`
- Test: `app/src/lib/listOrdering.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `app/src/lib/listOrdering.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isNumberTaken, nextPlayNumber, reorderIds } from './listOrdering'

describe('nextPlayNumber', () => {
  it('returns 1 when there are no existing numbers', () => {
    expect(nextPlayNumber([])).toBe(1)
  })

  it('returns one more than the highest existing number', () => {
    expect(nextPlayNumber([3, 1, 7, 2])).toBe(8)
  })
})

describe('isNumberTaken', () => {
  const plays = [
    { id: 'a', number: 10 },
    { id: 'b', number: 20 },
    { id: 'c', number: 30 },
  ]

  it('returns true when another play already has that number', () => {
    expect(isNumberTaken(plays, 20, 'a')).toBe(true)
  })

  it('returns false when the number is free', () => {
    expect(isNumberTaken(plays, 99, 'a')).toBe(false)
  })

  it('excludes the play being edited from the check (its own current number is not "taken")', () => {
    expect(isNumberTaken(plays, 10, 'a')).toBe(false)
  })
})

describe('reorderIds', () => {
  it('moves the dragged id to the target index, preserving the rest of the order', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an id from the middle to the front', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'c', 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an id from the middle to the end', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'b', 3)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('is a no-op (relative to the dragged id\'s own removal) when the target index equals its current position', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  })

  it('clamps an out-of-range index to the end of the list', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- listOrdering`
Expected: FAIL — `Cannot find module './listOrdering'`

- [ ] **Step 3: Implement the helpers**

Write `app/src/lib/listOrdering.ts`:
```ts
/** One more than the highest of the given numbers, or 1 if the list is empty. Used to assign
 *  a new play's number to one past whatever's currently highest in its unit. */
export function nextPlayNumber(existingNumbers: number[]): number {
  if (existingNumbers.length === 0) return 1
  return Math.max(...existingNumbers) + 1
}

/** True if `candidate` is already used by a play other than `excludePlayId` (typically the
 *  play currently being renumbered, so its own existing number doesn't flag as a conflict). */
export function isNumberTaken(plays: { id: string; number: number }[], candidate: number, excludePlayId: string): boolean {
  return plays.some((p) => p.id !== excludePlayId && p.number === candidate)
}

/**
 * Given the current ordered list of ids and the id being dragged, returns the new full ordered
 * list with the dragged id moved to `newIndex`. The returned array's index of each id is what
 * gets written back as that item's sortOrder after a drag-and-drop reorder.
 */
export function reorderIds(ids: string[], draggedId: string, newIndex: number): string[] {
  const withoutDragged = ids.filter((id) => id !== draggedId)
  const clampedIndex = Math.max(0, Math.min(newIndex, withoutDragged.length))
  return [...withoutDragged.slice(0, clampedIndex), draggedId, ...withoutDragged.slice(clampedIndex)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- listOrdering`
Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/lib/listOrdering.ts app/src/lib/listOrdering.test.ts
git commit -m "Add pure list-ordering helpers: next play number, duplicate check, reorder"
```

---

### Task 3: Row mappers

**Files:**
- Modify: `app/src/state/playbookStore.mappers.ts`
- Modify: `app/src/state/playbookStore.mappers.test.ts`

- [ ] **Step 1: Update the row types and mapper functions**

Read the current `app/src/state/playbookStore.mappers.ts` first. Modify `FormationRow` to add `sort_order`:
```ts
export interface FormationRow {
  id: string
  unit: string
  name: string
  players: Formation['players']
  sort_order: number
}
```

Modify `PlayRow` to add `sort_order` and `number`:
```ts
export interface PlayRow {
  id: string
  unit: string
  formation_id: string
  category_id: string
  name: string
  players: Play['players']
  annotations: Play['annotations']
  position_notes: Play['positionNotes']
  sort_order: number
  number: number
}
```

Modify `rowToFormation` to map the new field:
```ts
export function rowToFormation(row: FormationRow): Formation {
  return { id: row.id, name: row.name, unit: row.unit as Formation['unit'], players: row.players ?? [], sortOrder: row.sort_order }
}
```

Modify `rowToPlay` to map both new fields:
```ts
export function rowToPlay(row: PlayRow): Play {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit as Play['unit'],
    formationId: row.formation_id,
    categoryId: row.category_id,
    players: row.players ?? [],
    annotations: row.annotations ?? [],
    positionNotes: row.position_notes ?? {},
    sortOrder: row.sort_order,
    number: row.number,
  }
}
```

Modify `playToInsertRow` to include both new fields:
```ts
export function playToInsertRow(play: Play, teamId: string) {
  return {
    id: play.id,
    team_id: teamId,
    unit: play.unit,
    formation_id: play.formationId,
    category_id: play.categoryId,
    name: play.name,
    players: play.players,
    annotations: play.annotations,
    position_notes: play.positionNotes,
    sort_order: play.sortOrder,
    number: play.number,
  }
}
```

Modify `playToUpdateRow` to include both new fields (so an ordinary play save, e.g. from the play editor, round-trips its current number/sortOrder rather than silently reverting them):
```ts
export function playToUpdateRow(play: Play) {
  return {
    name: play.name,
    players: play.players,
    annotations: play.annotations,
    position_notes: play.positionNotes,
    category_id: play.categoryId,
    sort_order: play.sortOrder,
    number: play.number,
    updated_at: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Update the existing mapper tests for the new fields**

Read the current `app/src/state/playbookStore.mappers.test.ts` first (it hasn't changed since it was written). Replace it in full with:
```ts
import { describe, expect, it } from 'vitest'
import { rowToCategory, rowToFormation, rowToPlay, playToInsertRow, playToUpdateRow } from './playbookStore.mappers'
import type { Play } from '../types/play'

describe('rowToFormation', () => {
  it('maps a DB row to the app Formation shape', () => {
    const row = { id: '1', unit: 'offense', name: 'I Right', players: [{ id: 'X', label: 'X', role: 'skill' as const, x: 12, y: 30 }], sort_order: 2 }
    expect(rowToFormation(row)).toEqual({ id: '1', name: 'I Right', unit: 'offense', players: row.players, sortOrder: 2 })
  })

  it('defaults players to an empty array when null', () => {
    const row = { id: '1', unit: 'offense', name: 'Empty', players: null as unknown as [], sort_order: 0 }
    expect(rowToFormation(row).players).toEqual([])
  })
})

describe('rowToCategory', () => {
  it('maps a DB row to the app Category shape', () => {
    expect(rowToCategory({ id: '1', unit: 'offense', name: 'Run' })).toEqual({ id: '1', name: 'Run', unit: 'offense' })
  })
})

describe('rowToPlay', () => {
  it('maps snake_case DB columns to the app Play shape', () => {
    const row = {
      id: '1',
      unit: 'offense',
      formation_id: 'f1',
      category_id: 'c1',
      name: 'Play 1',
      players: [],
      annotations: [],
      position_notes: { X: 'go deep' },
      sort_order: 4,
      number: 12,
    }
    expect(rowToPlay(row)).toEqual({
      id: '1',
      name: 'Play 1',
      unit: 'offense',
      formationId: 'f1',
      categoryId: 'c1',
      players: [],
      annotations: [],
      positionNotes: { X: 'go deep' },
      sortOrder: 4,
      number: 12,
    })
  })

  it('defaults jsonb columns to empty values when null', () => {
    const row = {
      id: '1',
      unit: 'offense',
      formation_id: 'f1',
      category_id: 'c1',
      name: 'Play 1',
      players: null as any,
      annotations: null as any,
      position_notes: null as any,
      sort_order: 0,
      number: 1,
    }
    const play = rowToPlay(row)
    expect(play.players).toEqual([])
    expect(play.annotations).toEqual([])
    expect(play.positionNotes).toEqual({})
  })
})

describe('playToInsertRow / playToUpdateRow', () => {
  const play: Play = {
    id: '1',
    name: 'Play 1',
    unit: 'offense',
    formationId: 'f1',
    categoryId: 'c1',
    players: [],
    annotations: [],
    positionNotes: {},
    sortOrder: 3,
    number: 12,
  }

  it('playToInsertRow includes team_id, snake_case columns, sort_order, and number', () => {
    expect(playToInsertRow(play, 'team-1')).toEqual({
      id: '1',
      team_id: 'team-1',
      unit: 'offense',
      formation_id: 'f1',
      category_id: 'c1',
      name: 'Play 1',
      players: [],
      annotations: [],
      position_notes: {},
      sort_order: 3,
      number: 12,
    })
  })

  it('playToUpdateRow omits id/team_id, includes sort_order/number, and includes updated_at', () => {
    const row = playToUpdateRow(play)
    expect(row).toMatchObject({ name: 'Play 1', players: [], annotations: [], position_notes: {}, category_id: 'c1', sort_order: 3, number: 12 })
    expect(row.updated_at).toEqual(expect.any(String))
  })
})
```

- [ ] **Step 3: Run the mapper tests**

Run: `cd app && npm test -- playbookStore.mappers`
Expected: `8 passed`

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/playbookStore.mappers.ts app/src/state/playbookStore.mappers.test.ts
git commit -m "Map sort_order/number through the formation and play row mappers"
```

---

### Task 4: Delete, reorder, and number assignment in the playbook store

**Files:**
- Modify: `app/src/state/playbookStore.tsx`
- Modify: `app/src/state/playbookStore.test.tsx`

- [ ] **Step 1: Add the new operations to the context interface**

Read the current `app/src/state/playbookStore.tsx` first. Modify the `PlaybookContextValue` interface — add these four lines (position doesn't matter, but grouping them near their same-entity siblings keeps it readable):
```ts
  deleteFormation: (id: string) => Promise<{ blocked: true; playNames: string[] } | { blocked: false }>
  deletePlay: (id: string) => Promise<void>
  reorderFormations: (unit: Unit, orderedIds: string[]) => Promise<void>
  reorderPlays: (unit: Unit, orderedIds: string[]) => Promise<void>
```
(`createFormation`, `updateFormation`, `createPlay`, `updatePlay`, `createCategory`, `getFormation` all stay exactly as they are — only additions here.)

- [ ] **Step 2: Order fetches by sort_order instead of created_at**

In the `useEffect` that loads data, change:
```ts
    Promise.all([
      supabase.from('formations').select('*').order('created_at'),
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('plays').select('*').order('created_at'),
    ]).then(([f, c, p]) => {
```
to:
```ts
    Promise.all([
      supabase.from('formations').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('plays').select('*').order('sort_order'),
    ]).then(([f, c, p]) => {
```
(Categories keep `created_at` — no reorder feature for them in this phase.)

- [ ] **Step 3: Assign sortOrder/number when creating a formation or play**

Modify `createPlay` — change:
```ts
  const createPlay: PlaybookContextValue['createPlay'] = useCallback(
    ({ name, unit, formationId, categoryId, positionNotes }) => {
      const formation = formations.find((f) => f.id === formationId)
      const play: Play = {
        id: crypto.randomUUID(),
        name,
        unit,
        formationId,
        categoryId,
        positionNotes,
        annotations: [],
        players: (formation?.players ?? []).map((p) => ({ ...p, route: [] })),
      }
```
to:
```ts
  const createPlay: PlaybookContextValue['createPlay'] = useCallback(
    ({ name, unit, formationId, categoryId, positionNotes }) => {
      const formation = formations.find((f) => f.id === formationId)
      const unitPlays = plays.filter((p) => p.unit === unit)
      const play: Play = {
        id: crypto.randomUUID(),
        name,
        unit,
        formationId,
        categoryId,
        positionNotes,
        annotations: [],
        players: (formation?.players ?? []).map((p) => ({ ...p, route: [] })),
        sortOrder: unitPlays.length === 0 ? 0 : Math.max(...unitPlays.map((p) => p.sortOrder)) + 1,
        number: nextPlayNumber(unitPlays.map((p) => p.number)),
      }
```
(Leave the rest of `createPlay` — the `setPlays`/Supabase-insert block — exactly as it is; it already persists the whole `play` object via `playToInsertRow`, which Task 3 already taught to include `sort_order`/`number`.) Add `plays` to `createPlay`'s dependency array: change `[formations, teamId]` to `[formations, plays, teamId]`.

Add the import at the top of the file (alongside the existing `playbookStore.mappers` import line):
```ts
import { nextPlayNumber } from '../lib/listOrdering'
```

Modify `createFormation` — change:
```ts
  const createFormation: PlaybookContextValue['createFormation'] = useCallback(
    async ({ name, unit, players }) => {
      if (!teamId) throw new Error('No team')
      const { data, error } = await supabase.from('formations').insert({ team_id: teamId, unit, name, players }).select().single()
```
to:
```ts
  const createFormation: PlaybookContextValue['createFormation'] = useCallback(
    async ({ name, unit, players }) => {
      if (!teamId) throw new Error('No team')
      const unitFormations = formations.filter((f) => f.unit === unit)
      const sortOrder = unitFormations.length === 0 ? 0 : Math.max(...unitFormations.map((f) => f.sortOrder)) + 1
      const { data, error } = await supabase.from('formations').insert({ team_id: teamId, unit, name, players, sort_order: sortOrder }).select().single()
```
(`createFormation`'s dependency array already includes `[teamId]` only — it now also reads `formations`, so change it to `[teamId, formations]`.)

- [ ] **Step 4: Add deleteFormation, deletePlay, reorderFormations, reorderPlays**

Add these four callbacks after `updateFormation` and before `createCategory`:
```ts
  const deleteFormation: PlaybookContextValue['deleteFormation'] = useCallback(
    async (id: string) => {
      const blockingPlays = plays.filter((p) => p.formationId === id)
      if (blockingPlays.length > 0) {
        return { blocked: true as const, playNames: blockingPlays.map((p) => p.name) }
      }
      const { error } = await supabase.from('formations').delete().eq('id', id)
      if (error) throw error
      setFormations((prev) => prev.filter((f) => f.id !== id))
      return { blocked: false as const }
    },
    [plays],
  )

  const deletePlay: PlaybookContextValue['deletePlay'] = useCallback(async (id: string) => {
    const { error } = await supabase.from('plays').delete().eq('id', id)
    if (error) throw error
    setPlays((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const reorderFormations: PlaybookContextValue['reorderFormations'] = useCallback(async (unit: Unit, orderedIds: string[]) => {
    setFormations((prev) =>
      prev.map((f) => {
        if (f.unit !== unit) return f
        const idx = orderedIds.indexOf(f.id)
        return idx === -1 ? f : { ...f, sortOrder: idx }
      }),
    )
    await Promise.all(orderedIds.map((id, idx) => supabase.from('formations').update({ sort_order: idx }).eq('id', id)))
  }, [])

  const reorderPlays: PlaybookContextValue['reorderPlays'] = useCallback(async (unit: Unit, orderedIds: string[]) => {
    setPlays((prev) =>
      prev.map((p) => {
        if (p.unit !== unit) return p
        const idx = orderedIds.indexOf(p.id)
        return idx === -1 ? p : { ...p, sortOrder: idx }
      }),
    )
    await Promise.all(orderedIds.map((id, idx) => supabase.from('plays').update({ sort_order: idx }).eq('id', id)))
  }, [])
```

- [ ] **Step 5: Expose the new operations from the provider**

In the `value` object literal, add the four new operations (position doesn't matter, but keep it readable):
```ts
      deleteFormation,
      deletePlay,
      reorderFormations,
      reorderPlays,
```
Add the same four names to the `useMemo` dependency array.

- [ ] **Step 6: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: still errors — expected, since `playbookStore.test.tsx`'s hand-written `OFFENSE_PLAYERS`/`FORMATION_ROWS` fixtures and the `Formation`/`Play` object literals in this file's own tests don't yet supply `sortOrder`/`number`. Fixed in Step 7.

- [ ] **Step 7: Update the store's own tests for the new fields and operations**

Read the current `app/src/state/playbookStore.test.tsx` first (it hasn't changed since the prior phase added the `updateFormation` tests). Replace it in full with:
```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { PlaybookProvider, usePlaybook } from './playbookStore'
import type { ReactNode } from 'react'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' }, teamName: 'Test Team' }),
}))

// The store now fetches formations/categories/plays from Supabase on mount, so the
// client is mocked here with deterministic in-memory data instead of hitting the
// network. This keeps the tests fast and offline while still exercising the real
// async load -> local-state (createPlay/updatePlay) flow.
const OFFENSE_PLAYERS = [
  { id: 'X', label: 'X', role: 'skill', x: 12, y: 30 },
  { id: 'LT', label: 'LT', role: 'lineman', x: 38, y: 30 },
  { id: 'LG', label: 'LG', role: 'lineman', x: 42, y: 30 },
  { id: 'C', label: 'C', role: 'lineman', x: 46, y: 30 },
  { id: 'RG', label: 'RG', role: 'lineman', x: 50, y: 30 },
  { id: 'RT', label: 'RT', role: 'lineman', x: 54, y: 30 },
  { id: 'Y', label: 'Y', role: 'skill', x: 58, y: 30 },
  { id: 'O', label: 'O', role: 'qb', x: 46, y: 34 },
  { id: 'F', label: 'F', role: 'skill', x: 46, y: 38 },
  { id: 'H', label: 'H', role: 'skill', x: 46, y: 42 },
  { id: 'Z', label: 'Z', role: 'skill', x: 68, y: 32 },
]

const FORMATION_ROWS = [
  { id: 'i-right', unit: 'offense', name: 'I Right', players: OFFENSE_PLAYERS, sort_order: 0 },
  { id: 'split-right', unit: 'offense', name: 'Split Right', players: OFFENSE_PLAYERS, sort_order: 1 },
  { id: 'deuce', unit: 'offense', name: 'Deuce', players: OFFENSE_PLAYERS, sort_order: 2 },
  { id: 'duo', unit: 'offense', name: 'Duo', players: OFFENSE_PLAYERS, sort_order: 3 },
]

const CATEGORY_ROWS = [{ id: 'run', unit: 'offense', name: 'Run' }]

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: PromiseLike<typeof result> & Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    single: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    then: (onfulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onfulfilled),
  } as never
  return builder
}

// The formations table needs richer behavior than the generic makeBuilder: the initial
// `.select().order()` load must resolve to the full row list; `.update(...).eq(...).select().single()`
// (from updateFormation) must resolve to just the single updated row; `.delete().eq(...)`
// awaited directly with no further chaining (from deleteFormation, reorderFormations) must
// resolve to a plain `{ data: null, error: null }`. `eq()`'s returned builder is itself
// thenable (has a `.then`) so it can be awaited directly for the delete/reorder case *or*
// chained further into `.select().single()` for the update case — both paths resolve through
// the same pure `resolveEq()` read of the current closure state, so awaiting it more than once
// (once implicitly via `.eq()`'s own thenable, once explicitly via `.single()`) is safe: it has
// no side effects, so it can't produce a different result the second time.
function makeFormationsBuilder() {
  let updatePayload: Record<string, unknown> | null = null
  let eqId: string | null = null
  let deleted = false

  const resolveEq = (): { data: unknown; error: unknown } => {
    const original = FORMATION_ROWS.find((f) => f.id === eqId)
    if (deleted) return { data: null, error: null }
    if (updatePayload) {
      const data = original ? { ...original, ...updatePayload } : null
      return { data, error: data ? null : new Error('Formation not found') }
    }
    return { data: original ?? null, error: null }
  }

  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    eq: (_col: unknown, val: unknown) => {
      eqId = String(val)
      return builder
    },
    insert: () => builder,
    update: (payload: unknown) => {
      updatePayload = payload as Record<string, unknown>
      return builder
    },
    delete: () => {
      deleted = true
      return builder
    },
    order: () => Promise.resolve({ data: FORMATION_ROWS, error: null }),
    single: () => Promise.resolve(resolveEq()),
    then: (onfulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(resolveEq()).then(onfulfilled),
  }
  return builder
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'formations') return makeFormationsBuilder()
      if (table === 'categories') return makeBuilder({ data: CATEGORY_ROWS, error: null })
      if (table === 'plays') return makeBuilder({ data: [], error: null })
      return makeBuilder({ data: [], error: null })
    },
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <PlaybookProvider>{children}</PlaybookProvider>

describe('playbookStore', () => {
  it('seeds formationsForUnit with the built-in offensive formations', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const offense = result.current.formationsForUnit('offense')
    expect(offense.map((f) => f.id)).toEqual(['i-right', 'split-right', 'deuce', 'duo'])
  })

  it('createPlay seeds players from the chosen formation with empty routes, and assigns sortOrder 0 and number 1 for the first play in a unit', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
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
    expect(play!.sortOrder).toBe(0)
    expect(play!.number).toBe(1)
  })

  it('createPlay assigns the next sortOrder and number after existing plays in the same unit', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.createPlay({ name: 'First', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} })
    })
    let secondId = ''
    act(() => {
      const play = result.current.createPlay({ name: 'Second', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} })
      secondId = play.id
    })
    const second = result.current.plays.find((p) => p.id === secondId)!
    expect(second.sortOrder).toBe(1)
    expect(second.number).toBe(2)
  })

  it('updatePlay replaces the play with matching id', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
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

  it('deletePlay removes the play from state', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let playId = ''
    act(() => {
      const play = result.current.createPlay({ name: 'Test Play', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} })
      playId = play.id
    })
    await act(async () => {
      await result.current.deletePlay(playId)
    })
    expect(result.current.plays.find((p) => p.id === playId)).toBeUndefined()
  })

  it('updateFormation replaces the formation with matching id and calls update, not insert', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const original = result.current.formations.find((f) => f.id === 'i-right')!
    await act(async () => {
      await result.current.updateFormation({ ...original, name: 'I Right (Edited)' })
    })
    expect(result.current.formations.find((f) => f.id === 'i-right')!.name).toBe('I Right (Edited)')
  })

  it('updateFormation throws when Supabase reports no matching row (e.g. blocked by RLS)', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const original = result.current.formations.find((f) => f.id === 'i-right')!
    await expect(
      act(async () => {
        await result.current.updateFormation({ ...original, id: 'does-not-exist' })
      }),
    ).rejects.toThrow()
  })

  it('deleteFormation is blocked with the blocking play names when a play references it', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.createPlay({ name: 'Uses I Right', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} })
    })
    let outcome: Awaited<ReturnType<typeof result.current.deleteFormation>> | undefined
    await act(async () => {
      outcome = await result.current.deleteFormation('i-right')
    })
    expect(outcome).toEqual({ blocked: true, playNames: ['Uses I Right'] })
    expect(result.current.formations.find((f) => f.id === 'i-right')).toBeDefined()
  })

  it('deleteFormation succeeds and removes the formation when nothing references it', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let outcome: Awaited<ReturnType<typeof result.current.deleteFormation>> | undefined
    await act(async () => {
      outcome = await result.current.deleteFormation('duo')
    })
    expect(outcome).toEqual({ blocked: false })
    expect(result.current.formations.find((f) => f.id === 'duo')).toBeUndefined()
  })

  it('reorderFormations writes the new sortOrder for each formation in the given unit', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reorderFormations('offense', ['duo', 'i-right', 'split-right', 'deuce'])
    })
    const byId = Object.fromEntries(result.current.formations.map((f) => [f.id, f.sortOrder]))
    expect(byId).toEqual({ duo: 0, 'i-right': 1, 'split-right': 2, deuce: 3 })
  })

  it('reorderPlays writes the new sortOrder for each play in the given unit', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let firstId = ''
    let secondId = ''
    act(() => {
      firstId = result.current.createPlay({ name: 'First', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} }).id
    })
    act(() => {
      secondId = result.current.createPlay({ name: 'Second', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} }).id
    })
    await act(async () => {
      await result.current.reorderPlays('offense', [secondId, firstId])
    })
    expect(result.current.plays.find((p) => p.id === secondId)!.sortOrder).toBe(0)
    expect(result.current.plays.find((p) => p.id === firstId)!.sortOrder).toBe(1)
  })
})
```

- [ ] **Step 8: Run the full test suite**

Run: `cd app && npm test`
Expected: all tests pass (existing `mirrorFormation`/`listOrdering`/`playbookStore.mappers` tests plus the expanded `playbookStore.test.tsx`).

- [ ] **Step 9: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/playbookStore.tsx app/src/state/playbookStore.test.tsx
git commit -m "Add delete, reorder, and number assignment to the playbook store"
```

---

### Task 5: dnd-kit dependency, grip icon, and shared delete-confirm modal

**Files:**
- Modify: `app/package.json` (via npm install)
- Modify: `app/src/components/icons.tsx`
- Create: `app/src/components/playbook/DeleteConfirmModal.tsx`

- [ ] **Step 1: Install dnd-kit**

Run: `cd app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: three packages added to `dependencies` in `package.json`, `package-lock.json` updated, 0 vulnerabilities (or only pre-existing ones — don't investigate new ones here, that's outside this task's scope).

- [ ] **Step 2: Add a drag-handle icon**

Modify `app/src/components/icons.tsx`. Add this export alongside the other icons (e.g. after `MirrorIcon`):
```tsx
export const GripIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
)
```

- [ ] **Step 3: Write the shared delete-confirm modal**

This handles both the plain "are you sure" case (no `blockedByNames` prop) and formations' blocked case (`blockedByNames` has at least one entry) with one component, matching the approved mockup.

Write `app/src/components/playbook/DeleteConfirmModal.tsx`:
```tsx
interface DeleteConfirmModalProps {
  itemName: string
  blockedByNames?: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ itemName, blockedByNames, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const blocked = !!blockedByNames && blockedByNames.length > 0

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">
          {blocked ? `Can't delete "${itemName}"` : `Delete "${itemName}"?`}
        </div>
        <div className="p-4 text-sm text-muted">
          {blocked ? (
            <>
              <p className="mb-2">Used by: {blockedByNames!.join(', ')}</p>
              <p>Reassign or delete those plays first.</p>
            </>
          ) : (
            <p>This can't be undone.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          {blocked ? (
            <button onClick={onCancel} className="rounded-standard bg-app-bg px-3 py-2 text-sm text-text">
              OK
            </button>
          ) : (
            <>
              <button onClick={onCancel} className="rounded-standard bg-app-bg px-3 py-2 text-sm text-muted">
                Cancel
              </button>
              <button onClick={onConfirm} className="rounded-standard bg-alert-red px-3 py-2 text-sm font-bold text-white">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/package.json app/package-lock.json app/src/components/icons.tsx app/src/components/playbook/DeleteConfirmModal.tsx
git commit -m "Add dnd-kit, grip icon, and shared delete-confirm modal"
```

---

### Task 6: Wire delete and drag-reorder into FormationsGallery

**Files:**
- Modify: `app/src/components/templates/FormationsGallery.tsx`

- [ ] **Step 1: Rewrite the component**

Read the current `app/src/components/templates/FormationsGallery.tsx` first. Replace it with:
```tsx
import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Formation, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { reorderIds } from '../../lib/listOrdering'
import { FieldCanvas } from '../editor/FieldCanvas'
import { GripIcon, TrashIcon } from '../icons'
import { DeleteConfirmModal } from '../playbook/DeleteConfirmModal'

interface FormationsGalleryProps {
  unit: Unit
  onNewFormation: () => void
  onEditFormation: (formationId: string) => void
}

function SortableFormationCard({
  formation,
  onEditFormation,
  onDeleteRequest,
}: {
  formation: Formation
  onEditFormation: (id: string) => void
  onDeleteRequest: (formation: Formation) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: formation.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
        <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-muted hover:text-text">
          <GripIcon width={14} height={14} />
        </button>
        <button onClick={() => onDeleteRequest(formation)} aria-label="Delete formation" className="text-muted hover:text-alert-red">
          <TrashIcon width={14} height={14} />
        </button>
      </div>
      <button onClick={() => onEditFormation(formation.id)} className="flex flex-1 flex-col overflow-hidden text-left hover:opacity-90">
        <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
          <FieldCanvas players={formation.players.map((p) => ({ ...p, route: [] }))} readOnly />
        </div>
        <div className="px-2 pb-2 text-sm">{formation.name}</div>
      </button>
    </div>
  )
}

export function FormationsGallery({ unit, onNewFormation, onEditFormation }: FormationsGalleryProps) {
  const { formationsForUnit, deleteFormation, reorderFormations } = usePlaybook()
  const formations = formationsForUnit(unit)
  const [deleting, setDeleting] = useState<Formation | null>(null)
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = formations.map((f) => f.id)
    const newIndex = ids.indexOf(String(over.id))
    reorderFormations(unit, reorderIds(ids, String(active.id), newIndex))
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const result = await deleteFormation(deleting.id)
    if (result.blocked) {
      setBlockedNames(result.playNames)
    } else {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-4 p-6">
      <button
        onClick={onNewFormation}
        className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
      >
        + New Formation
      </button>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={formations.map((f) => f.id)} strategy={rectSortingStrategy}>
          {formations.map((f) => (
            <SortableFormationCard
              key={f.id}
              formation={f}
              onEditFormation={onEditFormation}
              onDeleteRequest={(formation) => {
                setDeleting(formation)
                setBlockedNames(null)
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      {deleting && (
        <DeleteConfirmModal
          itemName={deleting.name}
          blockedByNames={blockedNames ?? undefined}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null)
            setBlockedNames(null)
          }}
        />
      )}
    </div>
  )
}
```
(The drag handle and delete button are separate small buttons in their own row, not overlaid on the card — cleaner than absolute-positioning icons on top of the field diagram, while still matching the approved mockup's intent of a visible grip handle and delete icon on every card.)

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `cd app && npm test`
Expected: all tests still pass (this task adds no new test files — the drag/delete UI is covered by Task 8's manual verification).

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/templates/FormationsGallery.tsx
git commit -m "Add delete and drag-to-reorder to the formations gallery"
```

---

### Task 7: Wire delete, drag-reorder, and editable number into the play grid

**Files:**
- Modify: `app/src/components/playbook/PlayCard.tsx`
- Modify: `app/src/components/playbook/PlaybookListView.tsx`

- [ ] **Step 1: Rewrite PlayCard**

Read the current `app/src/components/playbook/PlayCard.tsx` first. Replace it with:
```tsx
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Play } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { isNumberTaken } from '../../lib/listOrdering'
import { FieldCanvas } from '../editor/FieldCanvas'
import { GripIcon, TrashIcon } from '../icons'
import { DeleteConfirmModal } from './DeleteConfirmModal'

interface PlayCardProps {
  play: Play
  onOpen: (id: string) => void
  sortable: boolean
}

export function PlayCard({ play, onOpen, sortable }: PlayCardProps) {
  const { plays, updatePlay, deletePlay } = usePlaybook()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: play.id, disabled: !sortable })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const [editingNumber, setEditingNumber] = useState(false)
  const [numberDraft, setNumberDraft] = useState(String(play.number))
  const [numberError, setNumberError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const commitNumber = () => {
    const parsed = Number(numberDraft)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setNumberError('Enter a whole number greater than 0.')
      return
    }
    const unitPlays = plays.filter((p) => p.unit === play.unit)
    if (isNumberTaken(unitPlays, parsed, play.id)) {
      setNumberError(`#${parsed} is already used by another play.`)
      return
    }
    setNumberError(null)
    setEditingNumber(false)
    if (parsed !== play.number) updatePlay({ ...play, number: parsed })
  }

  return (
    <div ref={setNodeRef} style={style} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
        {sortable && (
          <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-muted hover:text-text">
            <GripIcon width={14} height={14} />
          </button>
        )}
        {editingNumber ? (
          <input
            autoFocus
            value={numberDraft}
            onChange={(e) => setNumberDraft(e.target.value)}
            onBlur={commitNumber}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber()}
            className="w-10 rounded bg-surface-2 px-1 text-center text-text outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setNumberDraft(String(play.number))
              setNumberError(null)
              setEditingNumber(true)
            }}
            aria-label="Edit play number"
            className="rounded bg-accent-teal px-1.5 py-0.5 font-bold text-white"
          >
            #{play.number}
          </button>
        )}
        <span>ⓘ</span>
        <button onClick={() => setDeleting(true)} aria-label="Delete play" className="text-muted hover:text-alert-red">
          <TrashIcon width={14} height={14} />
        </button>
      </div>
      {numberError && <p className="px-2 text-[10px] text-alert-red">{numberError}</p>}
      <button onClick={() => onOpen(play.id)} className="flex flex-1 flex-col overflow-hidden text-left hover:opacity-90">
        <div className="flex-1">
          <FieldCanvas players={play.players} annotations={play.annotations} readOnly />
        </div>
        <div className="px-2 pb-2 text-sm">{play.name}</div>
      </button>
      {deleting && (
        <DeleteConfirmModal
          itemName={play.name}
          onConfirm={async () => {
            await deletePlay(play.id)
            setDeleting(false)
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  )
}
```
(`sortable` is `false` whenever a category/formation filter is active — see Task 7 Step 2. Reordering only applies to the full, unfiltered per-unit list, since "drag play A to sit right before play B" is ambiguous to interpret against the *global* per-unit order when B's neighbors in the global order are currently hidden by the filter. `useSortable`'s built-in `disabled` option handles this safely — it must still be called unconditionally on every render, inside a `DndContext`, which Task 7 Step 2 always provides regardless of filter state.)

- [ ] **Step 2: Wire DndContext/SortableContext into PlaybookListView**

Read the current `app/src/components/playbook/PlaybookListView.tsx` first. Replace it with:
```tsx
import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { usePlaybook } from '../../state/playbookStore'
import type { Unit } from '../../types/play'
import { reorderIds } from '../../lib/listOrdering'
import { AppShell } from '../layout/AppShell'
import { FilterTabs, type FilterMode } from './FilterTabs'
import { FormationList } from './FormationList'
import { NewPlayModal } from './NewPlayModal'
import { NewPlayTile } from './NewPlayTile'
import { PlayCard } from './PlayCard'
import { UnitTabs } from './UnitTabs'

interface PlaybookListViewProps {
  nav?: React.ReactNode
  onOpenPlay: (id: string) => void
  onOpenTemplates: (unit: Unit) => void
}

export function PlaybookListView({ nav, onOpenPlay, onOpenTemplates }: PlaybookListViewProps) {
  const { teamName, formationsForUnit, categories, plays, reorderPlays } = usePlaybook()
  const [unit, setUnit] = useState<Unit>('offense')
  const [filterMode, setFilterMode] = useState<FilterMode>('formations')
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const formations = formationsForUnit(unit)
  const unitCategories = categories.filter((c) => c.unit === unit)
  const unitPlays = plays.filter((p) => p.unit === unit)

  const listItems =
    filterMode === 'formations'
      ? formations.map((f) => ({ id: f.id, name: f.name, count: unitPlays.filter((p) => p.formationId === f.id).length }))
      : unitCategories.map((c) => ({ id: c.id, name: c.name, count: unitPlays.filter((p) => p.categoryId === c.id).length }))

  const visiblePlays = activeFilterId
    ? unitPlays.filter((p) => (filterMode === 'formations' ? p.formationId === activeFilterId : p.categoryId === activeFilterId))
    : unitPlays

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = unitPlays.map((p) => p.id)
    const newIndex = ids.indexOf(String(over.id))
    reorderPlays(unit, reorderIds(ids, String(active.id), newIndex))
  }

  return (
    <AppShell title={`${teamName} Playbooks`} nav={nav}>
      <UnitTabs unit={unit} onChange={(u) => (setUnit(u), setActiveFilterId(null))} />
      <div className="flex h-[calc(100%-3rem)]">
        <div className="flex flex-col">
          <FilterTabs mode={filterMode} onChange={setFilterMode} />
          <FormationList
            items={listItems}
            activeId={activeFilterId}
            onSelect={setActiveFilterId}
            editLabel={filterMode === 'formations' ? 'Edit Formations' : 'Edit Categories'}
            onEdit={() => onOpenTemplates(unit)}
          />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-wrap gap-4">
            <NewPlayTile unit={unit} onClick={() => setModalOpen(true)} />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visiblePlays.map((p) => p.id)} strategy={rectSortingStrategy}>
                {visiblePlays.map((p) => (
                  <PlayCard key={p.id} play={p} onOpen={onOpenPlay} sortable={!activeFilterId} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
      {modalOpen && (
        <NewPlayModal
          unit={unit}
          defaultFormationId={activeFilterId && filterMode === 'formations' ? activeFilterId : formations[0]?.id}
          onClose={() => setModalOpen(false)}
          onCreated={(id) => {
            setModalOpen(false)
            onOpenPlay(id)
          }}
        />
      )}
    </AppShell>
  )
}
```
(`DndContext`/`SortableContext` always wrap the grid, filtered or not — `PlayCard`'s own `sortable` prop, not the presence/absence of these providers, is what turns dragging on or off, since `useSortable` must always be called from inside a `DndContext`.)

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `cd app && npm test`
Expected: all tests still pass (this task adds no new test files — the drag/delete/number-edit UI is covered by Task 8's manual verification).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/playbook/PlayCard.tsx app/src/components/playbook/PlaybookListView.tsx
git commit -m "Add delete, drag-to-reorder, and editable numbers to the play grid"
```

---

### Task 8: Manual verification

No files change in this task — a checklist to run in the browser against the real Supabase project (dev server on port 5210, signed in), after running the Task 1 migration in the Supabase SQL Editor.

- [ ] **Step 1: Migration ran cleanly**

Confirm in the Supabase dashboard's Table Editor that `formations` and `plays` both have a `sort_order` column, `plays` also has a `number` column, and existing rows have plausible backfilled values (not all zero).

- [ ] **Step 2: Formation delete — blocked case**

Open Playbook → Edit Formations for a unit where a formation has at least one play built from it (e.g. offense's "I Right", if a play already uses it). Click its delete icon. Confirm the blocked message names the specific play(s), and there's no way to proceed with deletion from that dialog.

- [ ] **Step 3: Formation delete — allowed case**

Create a brand-new formation with no plays referencing it yet, delete it, confirm it's gone from the gallery and stays gone after a reload.

- [ ] **Step 4: Formation drag-reorder**

Drag a formation by its grip handle to a different position in the gallery. Confirm the grid re-flows live during the drag and the new order persists after a full page reload.

- [ ] **Step 5: Play delete**

Delete a play from the play grid, confirm the confirmation dialog, confirm it's gone and stays gone after reload.

- [ ] **Step 6: Play drag-reorder (unfiltered)**

With no category/formation filter active, drag a play to a new position. Confirm it persists after reload.

- [ ] **Step 7: Play drag-reorder is disabled while filtered**

Select a category or formation filter in the sidebar so the play grid shows a subset. Confirm the drag handle no longer appears (or doesn't respond) on the filtered cards.

- [ ] **Step 8: Play numbering — auto-assignment**

Create two new plays in the same unit back-to-back. Confirm the second gets the next number after the first (not a duplicate, not a gap unless one already existed).

- [ ] **Step 9: Play numbering — manual edit and duplicate rejection**

Click a play's number badge, change it to a number already used by another play in the same unit. Confirm an inline error appears and the change is rejected. Change it to a genuinely free number and confirm it saves and persists after reload.

- [ ] **Step 10: Numbering is per unit**

Confirm defense and special-teams plays have their own independent numbering (e.g. both units can have a play numbered "1" without conflict).

- [ ] **Step 11: No console errors**

Check the browser console throughout the above steps.

- [ ] **Step 12: Final full check**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test && npx oxlint`
Expected: no type errors, all tests pass, no new lint warnings introduced by this plan's files.
