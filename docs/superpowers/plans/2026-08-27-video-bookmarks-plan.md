# Video Review: Time Display & Bookmarked Moments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible current/duration time readout to the Video Review player, an on-screen "Bookmark" control that pauses playback and captures a timestamped freeform note, a collapsible drawer listing a clip's bookmarks (click-to-jump, inline edit, delete), and remote Prev/Next repurposed to step between bookmarks — while giving local device files, which today are never persisted at all, a stable identity (by filename+size) so their bookmarks survive across sessions.

**Architecture:** A new `bookmarks` table (one row per bookmark, team-scoped RLS matching every other table) backs a new `useClipBookmarks(clipId)` hook — a plain hook, not a global context, since bookmarks are only ever relevant to the one clip currently open. `VideoReviewPage` owns the hook and threads bookmarks + CRUD callbacks down to `VideoPlayerPage`, which owns all the interaction logic (creating on button click, remote-navigating between them) the same way it already owns trim/loop/draw state. Local files get a lightweight `clips` row keyed by a `filename:sizeBytes` fingerprint, found-or-created when picked via "+ Add Video" and reused directly (no re-matching) when reopened from the clip library via a native file-picker prompt.

**Tech Stack:** React, TypeScript, Vite, Tailwind v4, Vitest + React Testing Library, Supabase (RLS-only, migrations run manually by the user in the Supabase SQL Editor — never executed by the implementer).

---

## File Structure

```
supabase/migrations/0005_video_bookmarks.sql          # NEW
app/src/types/video.ts                                 # MODIFIED (VideoSource.fileSize)
app/src/state/clipsStore.mappers.ts                     # MODIFIED (ClipSourceType +'file')
app/src/lib/bookmarkUtils.ts / .test.ts                 # NEW
app/src/state/bookmarksStore.mappers.ts                 # NEW
app/src/state/bookmarksStore.ts / .test.tsx              # NEW
app/src/state/clipsStore.tsx                            # MODIFIED (findOrCreateFileClip)
app/src/state/clipsStore.test.tsx                       # NEW
app/src/components/source/VideoSourceModal.tsx          # MODIFIED (capture file size)
app/src/components/icons.tsx                            # MODIFIED (+BookmarkIcon, +FileIcon)
app/src/components/player/ControlBar.tsx                # MODIFIED (time display + Bookmark button)
app/src/components/player/BookmarksDrawer.tsx            # NEW
app/src/components/player/VideoPlayerPage.tsx            # MODIFIED
app/src/components/source/ClipLibrary.tsx                # MODIFIED
app/src/pages/VideoReviewPage.tsx                        # MODIFIED
```

---

### Task 1: Migration and type updates

**Files:**
- Create: `supabase/migrations/0005_video_bookmarks.sql`
- Modify: `app/src/types/video.ts`
- Modify: `app/src/state/clipsStore.mappers.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_video_bookmarks.sql`:

```sql
-- Adds bookmarked-moment support to Video Review, plus a 'file' source type for local
-- device files so they can have bookmarks too (see the design spec for why local files
-- need a clips row despite never having a real video reference).
-- Run this once in the Supabase SQL Editor, the same way 0001-0004 were run. Not
-- executed by the app or by Claude — the anon/publishable key has no schema-modification
-- permission.

alter table clips drop constraint clips_source_type_check;
alter table clips add constraint clips_source_type_check check (source_type in ('youtube', 'drive', 'file'));

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  clip_id uuid not null references clips(id) on delete cascade,
  created_by uuid references profiles(id),
  time_seconds real not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table bookmarks enable row level security;

create policy "team-scoped select bookmarks" on bookmarks for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert bookmarks" on bookmarks for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update bookmarks" on bookmarks for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete bookmarks" on bookmarks for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));
```

- [ ] **Step 2: Add `fileSize` to `VideoSource`**

Read `app/src/types/video.ts` first. Modify the `VideoSource` interface:

```ts
export interface VideoSource {
  type: VideoSourceType
  url: string
  youtubeId?: string
  fileName?: string
  fileSize?: number
}
```

- [ ] **Step 3: Widen `ClipSourceType`**

Read `app/src/state/clipsStore.mappers.ts` first. Change:

```ts
export type ClipSourceType = 'youtube' | 'drive'
```

to:

```ts
export type ClipSourceType = 'youtube' | 'drive' | 'file'
```

- [ ] **Step 4: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (nothing consumes the new type value yet, so this is just confirming the type-only change is syntactically valid).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/football-coach-app/.worktrees/video-bookmarks
git add supabase/migrations/0005_video_bookmarks.sql app/src/types/video.ts app/src/state/clipsStore.mappers.ts
git commit -m "Add bookmarks table migration and widen clip source type for local files"
```

---

### Task 2: Pure bookmark helpers

**Files:**
- Create: `app/src/lib/bookmarkUtils.ts`
- Test: `app/src/lib/bookmarkUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/bookmarkUtils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fileFingerprint, findAdjacentBookmark, formatTimestamp } from './bookmarkUtils'

describe('formatTimestamp', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTimestamp(47)).toBe('0:47')
    expect(formatTimestamp(75)).toBe('1:15')
  })

  it('pads seconds under 10', () => {
    expect(formatTimestamp(65)).toBe('1:05')
  })

  it('does not wrap into an hours component past 59 minutes', () => {
    expect(formatTimestamp(3900)).toBe('65:00')
  })

  it('floors fractional seconds and clamps negative input to 0:00', () => {
    expect(formatTimestamp(47.9)).toBe('0:47')
    expect(formatTimestamp(-3)).toBe('0:00')
  })
})

describe('findAdjacentBookmark', () => {
  const bookmarks = [
    { id: 'a', timeSeconds: 10 },
    { id: 'b', timeSeconds: 30 },
    { id: 'c', timeSeconds: 60 },
  ]

  it('finds the next bookmark after the current time', () => {
    expect(findAdjacentBookmark(bookmarks, 15, 1)?.id).toBe('b')
  })

  it('finds the previous bookmark before the current time', () => {
    expect(findAdjacentBookmark(bookmarks, 45, -1)?.id).toBe('b')
  })

  it('returns null past the last bookmark going forward', () => {
    expect(findAdjacentBookmark(bookmarks, 60, 1)).toBeNull()
  })

  it('returns null before the first bookmark going backward', () => {
    expect(findAdjacentBookmark(bookmarks, 10, -1)).toBeNull()
  })

  it('does not treat sitting exactly on a bookmark as being past it in either direction', () => {
    expect(findAdjacentBookmark(bookmarks, 30, 1)?.id).toBe('c')
    expect(findAdjacentBookmark(bookmarks, 30, -1)?.id).toBe('a')
  })

  it('returns null when there are no bookmarks', () => {
    expect(findAdjacentBookmark([], 15, 1)).toBeNull()
  })

  it('works correctly regardless of input order', () => {
    const shuffled = [bookmarks[2], bookmarks[0], bookmarks[1]]
    expect(findAdjacentBookmark(shuffled, 15, 1)?.id).toBe('b')
  })
})

describe('fileFingerprint', () => {
  it('combines filename and size with a colon', () => {
    expect(fileFingerprint('cam1ghxcccos.mp4', 104857600)).toBe('cam1ghxcccos.mp4:104857600')
  })

  it('distinguishes same-named files with different sizes', () => {
    expect(fileFingerprint('file2.mp4', 977272934)).not.toBe(fileFingerprint('file2.mp4', 685836697))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/bookmarkUtils.test.ts`
Expected: FAIL — `Cannot find module './bookmarkUtils'`

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/bookmarkUtils.ts`:

```ts
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface TimedBookmark {
  id: string
  timeSeconds: number
}

// A small epsilon avoids sitting exactly on a bookmark (e.g. right after jumping to it)
// counting as already being "past" it in whichever direction you next navigate.
const EPSILON_SECONDS = 0.05

export function findAdjacentBookmark<T extends TimedBookmark>(
  bookmarks: T[],
  currentTime: number,
  direction: 1 | -1,
): T | null {
  const sorted = [...bookmarks].sort((a, b) => a.timeSeconds - b.timeSeconds)
  if (direction === 1) {
    return sorted.find((b) => b.timeSeconds > currentTime + EPSILON_SECONDS) ?? null
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].timeSeconds < currentTime - EPSILON_SECONDS) return sorted[i]
  }
  return null
}

export function fileFingerprint(fileName: string, sizeBytes: number): string {
  return `${fileName}:${sizeBytes}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/bookmarkUtils.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/bookmarkUtils.ts app/src/lib/bookmarkUtils.test.ts
git commit -m "Add pure timestamp formatting, bookmark-navigation, and file-fingerprint helpers"
```

---

### Task 3: Bookmarks state (mappers + hooks)

**Files:**
- Create: `app/src/state/bookmarksStore.mappers.ts`
- Create: `app/src/state/bookmarksStore.ts`
- Test: `app/src/state/bookmarksStore.test.tsx`

- [ ] **Step 1: Write the mappers**

Create `app/src/state/bookmarksStore.mappers.ts`:

```ts
export interface Bookmark {
  id: string
  clipId: string
  timeSeconds: number
  note: string
}

export interface BookmarkRow {
  id: string
  clip_id: string
  time_seconds: number
  note: string
}

export function rowToBookmark(row: BookmarkRow): Bookmark {
  return { id: row.id, clipId: row.clip_id, timeSeconds: row.time_seconds, note: row.note }
}

export function bookmarkToInsertRow(bookmark: Bookmark, teamId: string) {
  return {
    id: bookmark.id,
    team_id: teamId,
    clip_id: bookmark.clipId,
    time_seconds: bookmark.timeSeconds,
    note: bookmark.note,
  }
}
```

- [ ] **Step 2: Write the failing tests for the hooks**

Create `app/src/state/bookmarksStore.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useClipBookmarks, useBookmarkCountsByClip } from './bookmarksStore'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' } }),
}))

const BOOKMARK_ROWS = [
  { id: 'bm-1', clip_id: 'clip-1', time_seconds: 30, note: 'X ran wrong route' },
  { id: 'bm-2', clip_id: 'clip-1', time_seconds: 10, note: '' },
  { id: 'bm-3', clip_id: 'clip-2', time_seconds: 5, note: 'Defense blitzed' },
]

function makeBookmarksBuilder() {
  let eqClipId: string | null = null
  let eqId: string | null = null
  let updatePayload: Record<string, unknown> | null = null
  let deleted = false
  let insertedRow: Record<string, unknown> | null = null

  const builder = {
    select: (cols?: string) => {
      if (cols === 'clip_id') return Promise.resolve({ data: BOOKMARK_ROWS.map((r) => ({ clip_id: r.clip_id })), error: null })
      return builder
    },
    eq: (col: string, val: unknown) => {
      if (col === 'clip_id') eqClipId = String(val)
      else eqId = String(val)
      return builder
    },
    order: () => Promise.resolve({ data: BOOKMARK_ROWS.filter((r) => r.clip_id === eqClipId), error: null }),
    insert: (row: Record<string, unknown>) => {
      insertedRow = row
      return Promise.resolve({ data: null, error: null })
    },
    update: (payload: Record<string, unknown>) => {
      updatePayload = payload
      return builder
    },
    delete: () => {
      deleted = true
      return builder
    },
    then: (onfulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
      const result = deleted
        ? { data: null, error: null }
        : updatePayload
          ? { data: { id: eqId, ...updatePayload }, error: null }
          : { data: insertedRow, error: null }
      return Promise.resolve(result).then(onfulfilled)
    },
  }
  return builder
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bookmarks') return makeBookmarksBuilder()
      return { select: () => Promise.resolve({ data: [], error: null }) }
    },
  },
}))

describe('useClipBookmarks', () => {
  it('fetches bookmarks scoped to the given clip, ordered by time', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(['bm-2', 'bm-1'])
  })

  it('returns an empty list and does not fetch when clipId is null', async () => {
    const { result } = renderHook(() => useClipBookmarks(null))
    expect(result.current.bookmarks).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('createBookmark adds a bookmark to local state immediately, sorted by time', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created: ReturnType<typeof result.current.createBookmark>
    act(() => {
      created = result.current.createBookmark(20)
    })
    expect(created!.timeSeconds).toBe(20)
    expect(created!.note).toBe('')
    expect(result.current.bookmarks.map((b) => b.timeSeconds)).toEqual([10, 20, 30])
  })

  it('updateBookmarkNote updates the note in local state', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.updateBookmarkNote('bm-2', 'Good rep')
    })
    expect(result.current.bookmarks.find((b) => b.id === 'bm-2')!.note).toBe('Good rep')
  })

  it('deleteBookmark removes the bookmark from local state', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteBookmark('bm-1')
    })
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(['bm-2'])
  })
})

describe('useBookmarkCountsByClip', () => {
  it('counts bookmarks per clip_id', async () => {
    const { result } = renderHook(() => useBookmarkCountsByClip())
    await waitFor(() => expect(result.current).toEqual({ 'clip-1': 2, 'clip-2': 1 }))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npx vitest run src/state/bookmarksStore.test.tsx`
Expected: FAIL — `Cannot find module './bookmarksStore'`

- [ ] **Step 4: Write the hooks**

Create `app/src/state/bookmarksStore.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { bookmarkToInsertRow, rowToBookmark, type Bookmark } from './bookmarksStore.mappers'

export type { Bookmark } from './bookmarksStore.mappers'

/** Bookmarks for the one clip currently open for review. Not a global context — unlike
 *  playbook data (used across many simultaneous views), bookmarks only ever matter for
 *  whichever single clip is on screen, so there's no reason to load every clip's
 *  bookmarks up front. */
export function useClipBookmarks(clipId: string | null) {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clipId) {
      setBookmarks([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('bookmarks')
      .select('*')
      .eq('clip_id', clipId)
      .order('time_seconds')
      .then(({ data }) => {
        if (cancelled) return
        if (data) setBookmarks((data as unknown[]).map((row) => rowToBookmark(row as Parameters<typeof rowToBookmark>[0])))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clipId])

  const createBookmark = useCallback(
    (timeSeconds: number) => {
      if (!clipId) throw new Error('No clip open')
      const bookmark: Bookmark = { id: crypto.randomUUID(), clipId, timeSeconds, note: '' }
      setBookmarks((prev) => [...prev, bookmark].sort((a, b) => a.timeSeconds - b.timeSeconds))
      if (teamId) {
        supabase
          .from('bookmarks')
          .insert(bookmarkToInsertRow(bookmark, teamId))
          .then(({ error }: { error: unknown }) => {
            if (error) console.error('Failed to persist new bookmark', error)
          })
      }
      return bookmark
    },
    [clipId, teamId],
  )

  const updateBookmarkNote = useCallback((id: string, note: string) => {
    setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, note } : b)))
    supabase
      .from('bookmarks')
      .update({ note })
      .eq('id', id)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('Failed to persist bookmark note', error)
      })
  }, [])

  // Async and throwing (unlike create/update above) — this is the one bookmark write
  // wrapped in a confirm-then-retry UI (matching deleteFormation/deletePlay), which needs
  // a real rejection to catch and show a retryable error, not a silent console.error.
  const deleteBookmark = useCallback(async (id: string) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id)
    if (error) throw error
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  return { bookmarks, loading, createBookmark, updateBookmarkNote, deleteBookmark }
}

/** Bookmark counts per clip, for the clip-library badges. One team-scoped query (RLS
 *  handles the team filter, same as clipsStore's fetch), counted client-side — no new
 *  SQL function needed for what's a handful of rows per team. */
export function useBookmarkCountsByClip(): Record<string, number> {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    supabase
      .from('bookmarks')
      .select('clip_id')
      .then(({ data }: { data: { clip_id: string }[] | null }) => {
        if (cancelled || !data) return
        const next: Record<string, number> = {}
        for (const row of data) next[row.clip_id] = (next[row.clip_id] ?? 0) + 1
        setCounts(next)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return counts
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run src/state/bookmarksStore.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: Verify the whole suite and types still pass**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add app/src/state/bookmarksStore.mappers.ts app/src/state/bookmarksStore.ts app/src/state/bookmarksStore.test.tsx
git commit -m "Add useClipBookmarks and useBookmarkCountsByClip hooks"
```

---

### Task 4: Give local files a persistent clip identity

**Files:**
- Modify: `app/src/state/clipsStore.tsx`
- Test: `app/src/state/clipsStore.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `app/src/state/clipsStore.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ClipsProvider, useClips } from './clipsStore'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' } }),
}))

const EXISTING_FILE_CLIP = {
  id: 'clip-existing',
  source_type: 'file',
  source_ref: 'cam1ghxcccos.mp4:104857600',
  title: 'cam1ghxcccos.mp4',
  in_point: null,
  out_point: null,
  drawing_strokes: [],
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ order: () => Promise.resolve({ data: table === 'clips' ? [EXISTING_FILE_CLIP] : [], error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <ClipsProvider>{children}</ClipsProvider>

describe('findOrCreateFileClip', () => {
  it('reuses the existing clip when the fingerprint matches an already-loaded file clip', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let found
    act(() => {
      found = result.current.findOrCreateFileClip('cam1ghxcccos.mp4:104857600', 'cam1ghxcccos.mp4')
    })
    expect(found!.id).toBe('clip-existing')
    expect(result.current.clips).toHaveLength(1)
  })

  it('creates a new clip when no existing file clip matches the fingerprint', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created
    act(() => {
      created = result.current.findOrCreateFileClip('cam2ghxccthusg.mp4:685836697', 'cam2ghxccthusg.mp4')
    })
    expect(created!.sourceType).toBe('file')
    expect(created!.sourceRef).toBe('cam2ghxccthusg.mp4:685836697')
    expect(result.current.clips).toHaveLength(2)
  })

  it('does not match a different file with the same name but a different size', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let found
    act(() => {
      found = result.current.findOrCreateFileClip('cam1ghxcccos.mp4:999999999', 'cam1ghxcccos.mp4')
    })
    expect(found!.id).not.toBe('clip-existing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/state/clipsStore.test.tsx`
Expected: FAIL — `result.current.findOrCreateFileClip is not a function`

- [ ] **Step 3: Add `findOrCreateFileClip`**

Read `app/src/state/clipsStore.tsx` first. Add to the `ClipsContextValue` interface:

```ts
interface ClipsContextValue {
  loading: boolean
  clips: Clip[]
  createClip: (input: { sourceType: ClipSourceType; sourceRef: string; title?: string | null }) => Clip
  updateClip: (clip: Clip) => void
  findOrCreateFileClip: (fingerprint: string, fileName: string) => Clip
}
```

Add the implementation inside `ClipsProvider`, after `createClip`:

```ts
  const findOrCreateFileClip: ClipsContextValue['findOrCreateFileClip'] = useCallback(
    (fingerprint, fileName) => {
      const existing = clips.find((c) => c.sourceType === 'file' && c.sourceRef === fingerprint)
      if (existing) return existing
      return createClip({ sourceType: 'file', sourceRef: fingerprint, title: fileName })
    },
    [clips, createClip],
  )
```

Add it to the `value` `useMemo` and its dependency array:

```ts
  const value = useMemo<ClipsContextValue>(
    () => ({ loading, clips, createClip, updateClip, findOrCreateFileClip }),
    [loading, clips, createClip, updateClip, findOrCreateFileClip],
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/state/clipsStore.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Verify the whole suite and types still pass**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add app/src/state/clipsStore.tsx app/src/state/clipsStore.test.tsx
git commit -m "Add findOrCreateFileClip so local device files get a stable clip identity"
```

---

### Task 5: Capture file size when picking a local file

**Files:**
- Modify: `app/src/components/source/VideoSourceModal.tsx`

- [ ] **Step 1: Update `handleFileChange`**

Read `app/src/components/source/VideoSourceModal.tsx` first. Change:

```ts
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onSelect({ type: 'file', url: URL.createObjectURL(file), fileName: file.name })
  }
```

to:

```ts
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onSelect({ type: 'file', url: URL.createObjectURL(file), fileName: file.name, fileSize: file.size })
  }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/VideoSourceModal.tsx
git commit -m "Capture file size when picking a local video, needed for the bookmark fingerprint"
```

---

### Task 6: Bookmark and file icons

**Files:**
- Modify: `app/src/components/icons.tsx`

- [ ] **Step 1: Add the icons**

Read `app/src/components/icons.tsx` first, and add these two exports at the end of the file, following the existing `base(p)` pattern:

```tsx
export const BookmarkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
)
export const FileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 2h9l5 5v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M15 2v5h5" />
  </svg>
)
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/icons.tsx
git commit -m "Add BookmarkIcon and FileIcon"
```

---

### Task 7: Time display and Bookmark button in ControlBar

**Files:**
- Modify: `app/src/components/player/ControlBar.tsx`

- [ ] **Step 1: Add props and the new control group**

Read `app/src/components/player/ControlBar.tsx` first. Update the imports:

```tsx
import { formatTimestamp } from '../../lib/bookmarkUtils'
import {
  BookmarkIcon,
  FastFwdIcon,
  FastRevIcon,
  InIcon,
  LoopIcon,
  OutIcon,
  PauseIcon,
  PencilIcon,
  PlayTriangleIcon,
  SlowFwdIcon,
  SlowRevIcon,
  TrashIcon,
} from '../icons'
```

Update `ControlBarProps`:

```tsx
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
}
```

Update the function signature and add a fourth control group at the end of the returned `<div>`, right after the drawing-tools group:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors from `VideoPlayerPage.tsx` not yet passing the three new required props — expected at this point, fixed in Task 9. Confirm the *only* errors are about missing props on `<ControlBar ...>` in `VideoPlayerPage.tsx`, not anything inside `ControlBar.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/player/ControlBar.tsx
git commit -m "Add time readout and Bookmark button to the player control bar"
```

---

### Task 8: BookmarksDrawer component

**Files:**
- Create: `app/src/components/player/BookmarksDrawer.tsx`

- [ ] **Step 1: Write the component**

Create `app/src/components/player/BookmarksDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Bookmark } from '../../state/bookmarksStore'
import { formatTimestamp } from '../../lib/bookmarkUtils'
import { TrashIcon } from '../icons'

interface BookmarksDrawerProps {
  bookmarks: Bookmark[]
  expanded: boolean
  onToggleExpanded: () => void
  focusBookmarkId: string | null
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
}

function BookmarkRow({
  bookmark,
  autoFocus,
  onFocusConsumed,
  onSeek,
  onUpdateNote,
  onDeleteRequest,
}: {
  bookmark: Bookmark
  autoFocus: boolean
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
}) {
  const [editing, setEditing] = useState(autoFocus)
  const [draft, setDraft] = useState(bookmark.note)
  const committedRef = useRef(false)

  // Fires once per mount, not on every autoFocus/prop change (empty deps): tells the
  // parent to clear its "focus this row" request immediately after we've applied it, so
  // a later unrelated remount of this row (e.g. collapsing/expanding the drawer) doesn't
  // reopen the editor against the user's wishes.
  useEffect(() => {
    if (autoFocus) onFocusConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    setEditing(false)
    if (draft !== bookmark.note) onUpdateNote(bookmark.id, draft)
  }

  return (
    <div className="flex items-center gap-2 rounded-standard px-2 py-1.5 text-sm hover:bg-white/5">
      <button
        onClick={() => onSeek(bookmark.timeSeconds)}
        className="shrink-0 font-bold text-accent-teal hover:underline"
        aria-label={`Jump to ${formatTimestamp(bookmark.timeSeconds)}`}
      >
        {formatTimestamp(bookmark.timeSeconds)}
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="flex-1 rounded bg-surface-2 px-2 py-0.5 text-text outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(bookmark.note)
            committedRef.current = false
            setEditing(true)
          }}
          className="flex-1 truncate text-left text-text hover:text-accent-teal"
        >
          {bookmark.note || <span className="text-muted">Add a note…</span>}
        </button>
      )}
      <button onClick={() => onDeleteRequest(bookmark)} aria-label="Delete bookmark" className="shrink-0 text-muted hover:text-alert-red">
        <TrashIcon width={14} height={14} />
      </button>
    </div>
  )
}

export function BookmarksDrawer({
  bookmarks,
  expanded,
  onToggleExpanded,
  focusBookmarkId,
  onFocusConsumed,
  onSeek,
  onUpdateNote,
  onDeleteRequest,
}: BookmarksDrawerProps) {
  return (
    <div className="border-t border-white/10">
      <button
        onClick={onToggleExpanded}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted hover:text-text"
      >
        <span>Bookmarks ({bookmarks.length})</span>
        <span>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="max-h-40 overflow-auto px-1 pb-2">
          {bookmarks.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted">No bookmarks yet.</p>
          ) : (
            bookmarks.map((b) => (
              <BookmarkRow
                key={b.id}
                bookmark={b}
                autoFocus={b.id === focusBookmarkId}
                onFocusConsumed={onFocusConsumed}
                onSeek={onSeek}
                onUpdateNote={onUpdateNote}
                onDeleteRequest={onDeleteRequest}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no *new* errors from this file (the pre-existing `ControlBar` prop errors from Task 7 remain until Task 9).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/player/BookmarksDrawer.tsx
git commit -m "Add BookmarksDrawer: collapsible list with click-to-jump, inline edit, delete"
```

---

### Task 9: Wire bookmarks into VideoPlayerPage

**Files:**
- Modify: `app/src/components/player/VideoPlayerPage.tsx`

- [ ] **Step 1: Rewrite the file**

Read `app/src/components/player/VideoPlayerPage.tsx` first. Replace it with:

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

interface VideoPlayerPageProps {
  source: VideoSource
  initialTrim?: { inPoint: number; outPoint: number }
  initialStrokes?: Stroke[]
  onStateChange?: (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => void
  bookmarks: Bookmark[]
  onCreateBookmark: (timeSeconds: number) => Bookmark
  onUpdateBookmarkNote: (id: string, note: string) => void
  onDeleteBookmark: (id: string) => Promise<void>
}

export function VideoPlayerPage({
  source,
  initialTrim,
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
    const created = onCreateBookmark(currentTime)
    setFocusBookmarkId(created.id)
    setDrawerExpanded(true)
  }, [currentTime, onCreateBookmark])

  const seekTo = useCallback((t: number) => {
    controllerRef.current?.seekTo(t)
    setCurrentTime(t)
  }, [])

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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: errors from `VideoReviewPage.tsx` not yet passing the new required props (`bookmarks`, `onCreateBookmark`, `onUpdateBookmarkNote`, `onDeleteBookmark`) and still passing the now-removed `onPrevClip`/`onNextClip` — expected at this point, fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/player/VideoPlayerPage.tsx
git commit -m "Wire bookmark creation, drawer, delete, and remote prev/next navigation into VideoPlayerPage"
```

---

### Task 10: Wire bookmarks and local-file identity into VideoReviewPage

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
```

Note what changed from the original: `handlePrevClip`/`handleNextClip` and the `onPrevClip`/`onNextClip` props passed to `VideoPlayerPage` are gone entirely — retired per the spec, since remote Prev/Next navigation now lives inside `VideoPlayerPage` itself, against the `bookmarks` prop it already receives.

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: a full clean compile, no errors. `ClipLibrary.tsx`'s old two-way `sourceType === 'youtube' ? ... : ...` ternary is still valid TypeScript even though `ClipSourceType` now has three members — it just silently renders the Drive icon for file-type clips until Task 11 gives it real three-way handling. Not a type error, just an incomplete behavior fixed next.

- [ ] **Step 3: Run the test suite too**

Run: `cd app && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/VideoReviewPage.tsx
git commit -m "Wire bookmarks and local-file reopen-via-file-picker into VideoReviewPage"
```

---

### Task 11: Local-file entries and bookmark counts in ClipLibrary

**Files:**
- Modify: `app/src/components/source/ClipLibrary.tsx`

- [ ] **Step 1: Rewrite the file**

Read `app/src/components/source/ClipLibrary.tsx` first. Replace it with:

```tsx
import { useClips, type Clip } from '../../state/clipsStore'
import { useBookmarkCountsByClip } from '../../state/bookmarksStore'
import { BookmarkIcon, DriveIcon, FileIcon, PlusIcon, YoutubeIcon } from '../icons'

interface ClipLibraryProps {
  onOpenClip: (clip: Clip) => void
  onAddNew: () => void
}

const SOURCE_ICONS = { youtube: YoutubeIcon, drive: DriveIcon, file: FileIcon } as const

export function ClipLibrary({ onOpenClip, onAddNew }: ClipLibraryProps) {
  const { loading, clips } = useClips()
  const bookmarkCounts = useBookmarkCountsByClip()

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
        {clips.map((clip) => {
          const Icon = SOURCE_ICONS[clip.sourceType]
          const count = bookmarkCounts[clip.id] ?? 0
          return (
            <button
              key={clip.id}
              onClick={() => onOpenClip(clip)}
              className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
            >
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
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the whole app compiles and tests pass**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors, all tests pass (this task adds no new test files — visual layout is covered by Task 12's manual verification).

- [ ] **Step 3: Run lint**

Run: `cd app && npx oxlint`
Expected: no new warnings introduced by this plan's files.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/source/ClipLibrary.tsx
git commit -m "Show local-file clips and bookmark-count badges in the clip library"
```

---

### Task 12: Manual verification

No files change in this task — a checklist to run in the browser against the real Supabase project (dev server, signed in), after running the Task 1 migration in the Supabase SQL Editor.

- [ ] **Step 1: Migration ran cleanly**

Confirm in the Supabase dashboard's Table Editor that a `bookmarks` table exists with the expected columns, and that `clips.source_type`'s check constraint now allows `'file'` (e.g. by checking the constraint definition, or simply by completing Step 4 below without a constraint-violation error).

- [ ] **Step 2: Time display**

Open any clip. Confirm the `m:ss / m:ss` readout appears in the control bar and updates live as the video plays and as you scrub.

- [ ] **Step 3: Creating a bookmark**

While a clip is playing, click Bookmark. Confirm: playback pauses, the bookmarks drawer expands, a new row appears at the current time with its note field focused and empty. Type a note and press Enter — confirm it's saved and the input closes.

- [ ] **Step 4: Bookmark persists after reload**

Reload the page, reopen the same clip. Confirm the bookmark and its note are still there.

- [ ] **Step 5: Click-to-jump**

With the drawer expanded, click a bookmark's timestamp. Confirm the video seeks there without changing whether it was playing or paused.

- [ ] **Step 6: Edit and delete**

Click a bookmark's note text, change it, blur to commit — confirm it saves. Click delete on a bookmark — confirm the confirm dialog appears, confirm it deletes and stays deleted after reload.

- [ ] **Step 7: Remote Prev/Next now navigate bookmarks**

With a real or simulated Ctrl+Shift+2 / Ctrl+Shift+3 keypress (the remote chord), confirm the playhead jumps to the previous/next bookmark relative to the current position, and is a no-op at the first/last bookmark or when there are no bookmarks. Confirm the existing Tag button (Ctrl+Shift+8) still marks in/out trim points exactly as before, unaffected.

- [ ] **Step 8: Local file — first save**

Pick a local video file via "+ Add Video" → "Device / Photos". Add a bookmark. Go back to the library — confirm the file now appears there with a "Select to play" affordance and a bookmark-count badge.

- [ ] **Step 9: Local file — reopening preserves bookmarks**

From the library, click that same local-file entry. Confirm it prompts the native file picker. Select the *same* file again — confirm the video plays and the previously-created bookmark is still there.

- [ ] **Step 10: Local file — a different file doesn't inherit bookmarks**

Pick a *different* local file via "+ Add Video". Confirm it opens with no bookmarks (not the previous file's).

- [ ] **Step 11: No console errors**

Check the browser console throughout the above steps.

- [ ] **Step 12: Final full check**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json && npm test && npx oxlint`
Expected: no type errors, all tests pass, no new lint warnings introduced by this plan's files.
