# Game Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a coach copy a link to a game (or one specific bookmarked moment inside a clip) that jumps a teammate straight to it, using the app's own URL and existing team-scoped RLS — no new backend table, no router dependency.

**Architecture:** A pure `shareLink.ts` module builds `?game=<id>` / `?game=<id>&clip=<id>&t=<seconds>` links and parses them back. A one-time bootstrap read in `main.tsx` stashes any such params into `sessionStorage` before the app renders (so they survive a magic-link auth redirect); `App.tsx` consumes that stash once auth resolves and hands the target down to `VideoReviewPage`, which resolves it against already-loaded games/clips and opens the right game → clip → timestamp, falling back to normal browsing on any miss. "Share" buttons on a game card and on each bookmark row build and copy the two link shapes.

**Tech Stack:** React + TypeScript, Vitest, existing `clipsStore`/`gamesStore`/`bookmarksStore` contexts, browser `sessionStorage` + Clipboard API. No new dependencies.

---

### Task 1: `shareLink.ts` — build/parse/stash pure functions

**Files:**
- Create: `app/src/lib/shareLink.ts`
- Test: `app/src/lib/shareLink.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/shareLink.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { buildGameShareUrl, buildMomentShareUrl, consumePendingShareTarget, parseShareParams, stashShareTargetFromUrl } from './shareLink'

describe('buildGameShareUrl / parseShareParams round trip', () => {
  it('round-trips a game-only link', () => {
    const url = buildGameShareUrl('game-1')
    expect(parseShareParams(new URL(url).search)).toEqual({ gameId: 'game-1', clipId: null, timeSeconds: null })
  })
})

describe('buildMomentShareUrl / parseShareParams round trip', () => {
  it('round-trips a moment link, flooring the seconds', () => {
    const url = buildMomentShareUrl('game-1', 'clip-1', 42.9)
    expect(parseShareParams(new URL(url).search)).toEqual({ gameId: 'game-1', clipId: 'clip-1', timeSeconds: 42 })
  })
})

describe('parseShareParams', () => {
  it('returns null when there is no game param', () => {
    expect(parseShareParams('?clip=clip-1&t=10')).toBeNull()
  })

  it('returns null timeSeconds for a non-numeric t', () => {
    expect(parseShareParams('?game=game-1&t=notanumber')).toEqual({ gameId: 'game-1', clipId: null, timeSeconds: null })
  })

  it('returns null for an empty search string', () => {
    expect(parseShareParams('')).toBeNull()
  })
})

describe('stashShareTargetFromUrl / consumePendingShareTarget', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stashes and then consumes a target found in the URL', () => {
    window.history.replaceState(null, '', '/?game=game-1&clip=clip-1&t=15')
    stashShareTargetFromUrl()
    expect(consumePendingShareTarget()).toEqual({ gameId: 'game-1', clipId: 'clip-1', timeSeconds: 15 })
  })

  it('consuming clears it — a second read returns null', () => {
    window.history.replaceState(null, '', '/?game=game-1')
    stashShareTargetFromUrl()
    consumePendingShareTarget()
    expect(consumePendingShareTarget()).toBeNull()
  })

  it('does not stash anything when the URL has no game param', () => {
    window.history.replaceState(null, '', '/')
    stashShareTargetFromUrl()
    expect(consumePendingShareTarget()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/lib/shareLink.test.ts`
Expected: FAIL — `Failed to resolve import "./shareLink"`

- [ ] **Step 3: Write the implementation**

```ts
// app/src/lib/shareLink.ts
export interface ShareTarget {
  gameId: string
  clipId: string | null
  timeSeconds: number | null
}

const STORAGE_KEY = 'pendingShareTarget'

export function buildGameShareUrl(gameId: string): string {
  const url = new URL(window.location.href)
  url.search = `?game=${encodeURIComponent(gameId)}`
  return url.toString()
}

export function buildMomentShareUrl(gameId: string, clipId: string, timeSeconds: number): string {
  const url = new URL(window.location.href)
  url.search = `?game=${encodeURIComponent(gameId)}&clip=${encodeURIComponent(clipId)}&t=${Math.floor(timeSeconds)}`
  return url.toString()
}

export function parseShareParams(search: string): ShareTarget | null {
  const params = new URLSearchParams(search)
  const gameId = params.get('game')
  if (!gameId) return null
  const clipId = params.get('clip')
  const tRaw = params.get('t')
  const timeSeconds = tRaw !== null && !Number.isNaN(Number(tRaw)) ? Number(tRaw) : null
  return { gameId, clipId, timeSeconds }
}

/** Called once at app bootstrap (see main.tsx), before anything renders — stashes the
 *  share target from the current URL's query params, if any, so it survives a
 *  magic-link auth redirect that may not preserve the original query string. */
export function stashShareTargetFromUrl(): void {
  const target = parseShareParams(window.location.search)
  if (target) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target))
}

/** Reads and clears the share target stashed above. Call exactly once, from a
 *  ref-guarded effect — reading clears the underlying storage, so a second call
 *  always returns null even if the original link is still in the address bar. */
export function consumePendingShareTarget(): ShareTarget | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORAGE_KEY)
  try {
    return JSON.parse(raw) as ShareTarget
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/shareLink.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/shareLink.ts app/src/lib/shareLink.test.ts
git commit -m "Add shareLink: build/parse/stash helpers for game and moment links"
```

---

### Task 2: Thread `gameId`/`clipId` through the player and add a per-bookmark share button

**Files:**
- Modify: `app/src/components/player/BookmarksDrawer.tsx`
- Modify: `app/src/components/player/VideoPlayerPage.tsx`
- Modify: `app/src/pages/VideoReviewPage.tsx`

- [ ] **Step 1: Rewrite `BookmarksDrawer.tsx` to accept `gameId`/`clipId` and add a share button per row**

Replace the full file:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Bookmark } from '../../state/bookmarksStore'
import { formatTimestamp } from '../../lib/bookmarkUtils'
import { buildMomentShareUrl } from '../../lib/shareLink'
import { CheckIcon, ShareIcon, TrashIcon } from '../icons'

interface BookmarksDrawerProps {
  bookmarks: Bookmark[]
  expanded: boolean
  onToggleExpanded: () => void
  /** The bookmark to open in edit mode, if any. Must be an id newly added to `bookmarks`
   *  this render (e.g. from onCreateBookmark) — setting it to an id that's already
   *  mounted is a no-op, since the row's initial-edit-state is only read once, at mount. */
  focusBookmarkId: string | null
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
  /** Needed to build a moment share link. Sharing a specific bookmark only makes sense
   *  once its clip belongs to a game — an "Unassigned" clip has no game to deep-link
   *  into, so `gameId` is null there and the per-row share button doesn't render. */
  gameId: string | null
  clipId: string
}

function BookmarkRow({
  bookmark,
  autoFocus,
  onFocusConsumed,
  onSeek,
  onUpdateNote,
  onDeleteRequest,
  onShare,
  justCopied,
}: {
  bookmark: Bookmark
  autoFocus: boolean
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
  onShare: (() => void) | null
  justCopied: boolean
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
      {onShare && (
        <button onClick={onShare} aria-label="Copy link to this moment" className="shrink-0 text-muted hover:text-accent-teal">
          {justCopied ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
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
  gameId,
  clipId,
}: BookmarksDrawerProps) {
  const [copiedBookmarkId, setCopiedBookmarkId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)

  const handleShare = async (bookmark: Bookmark) => {
    if (!gameId) return
    try {
      await navigator.clipboard.writeText(buildMomentShareUrl(gameId, clipId, bookmark.timeSeconds))
      setCopiedBookmarkId(bookmark.id)
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = window.setTimeout(() => setCopiedBookmarkId(null), 1500)
    } catch (error) {
      console.error('Failed to copy share link', error)
    }
  }

  return (
    <div className="border-t border-white/10">
      <button
        onClick={onToggleExpanded}
        aria-expanded={expanded}
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
                onShare={gameId ? () => handleShare(b) : null}
                justCopied={copiedBookmarkId === b.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `gameId`/`clipId`/`initialSeekTime` props to `VideoPlayerPage`, thread `gameId`/`clipId` to `BookmarksDrawer`, and seek once when a target time is given**

Edit `app/src/components/player/VideoPlayerPage.tsx` — update the props interface and destructure (around lines 13-33):

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

Right after the existing `seekTo` definition —

```tsx
  const seekTo = useCallback((t: number) => {
    controllerRef.current?.seekTo(t)
    setCurrentTime(t)
  }, [])
```

— insert a new effect:

```tsx

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
```

Update the `BookmarksDrawer` render call (currently starts `<BookmarksDrawer bookmarks={bookmarks} ...>`) to also pass the two new props:

```tsx
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
```

- [ ] **Step 3: Pass the two new required props from `VideoReviewPage`'s existing call site**

Edit `app/src/pages/VideoReviewPage.tsx` — in the `mode === 'player'` render block, change:

```tsx
          key={activeClip?.id ?? 'local-file'}
          source={source}
          initialTrim={
```

to:

```tsx
          key={activeClip?.id ?? 'local-file'}
          source={source}
          gameId={selectedGameId}
          clipId={activeClip?.id ?? ''}
          initialTrim={
```

- [ ] **Step 4: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all existing tests still pass (no new tests added this step — this is UI wiring, matching the codebase's existing convention of not unit-testing page/component wiring).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/player/BookmarksDrawer.tsx app/src/components/player/VideoPlayerPage.tsx app/src/pages/VideoReviewPage.tsx
git commit -m "Add per-bookmark share button; thread gameId/clipId/initialSeekTime through the player"
```

---

### Task 3: Resolve a share link into an open game/clip/timestamp on load

**This is the highest-risk task** — it wires a stash-then-consume flow across `main.tsx`, `App.tsx`, and `VideoReviewPage.tsx`'s existing mode state machine. Give this one full spec-compliance + code-quality subagent review (per `subagent-driven-development`), not the lighter direct-verification pass used for the other tasks in this plan.

**Files:**
- Modify: `app/src/main.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/pages/VideoReviewPage.tsx`

- [ ] **Step 1: Stash any share-link params before the app renders**

Replace the full file `app/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { stashShareTargetFromUrl } from './lib/shareLink'

stashShareTargetFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Consume the stashed target once in `AuthenticatedApp` and thread it down**

Replace the full file `app/src/App.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { JoinTeamScreen } from './auth/JoinTeamScreen'
import { PlaybookProvider } from './state/playbookStore'
import { ClipsProvider } from './state/clipsStore'
import { GamesProvider } from './state/gamesStore'
import { VideoReviewPage } from './pages/VideoReviewPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { consumePendingShareTarget, type ShareTarget } from './lib/shareLink'

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

function AuthenticatedApp() {
  const [section, setSection] = useState<Section>('video')
  const [pendingTarget, setPendingTarget] = useState<ShareTarget | null>(null)
  const consumedRef = useRef(false)

  // Runs once — the share target (if any) was stashed by main.tsx before this ever
  // mounted, since a magic-link auth redirect may not preserve the original URL's query
  // params. Reading it clears the underlying storage, so this must only happen once;
  // the ref (not just checking `pendingTarget`) guards against StrictMode's dev-only
  // double-invoke of this effect, which would otherwise consume-and-lose it on the
  // second invocation before the first one's state update had a chance to matter.
  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true
    const target = consumePendingShareTarget()
    if (target) {
      setPendingTarget(target)
      setSection('video')
    }
  }, [])

  const handlePendingTargetHandled = useCallback(() => setPendingTarget(null), [])

  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      <ClipsProvider>
        <GamesProvider>
          {section === 'video' ? (
            <VideoReviewPage nav={nav} pendingTarget={pendingTarget} onPendingTargetHandled={handlePendingTargetHandled} />
          ) : (
            <PlaybookPage nav={nav} />
          )}
        </GamesProvider>
      </ClipsProvider>
    </PlaybookProvider>
  )
}

function Gate() {
  const { loading, session, profile, profileError } = useAuth()

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-app-bg text-muted">Loading…</div>
  }
  if (!session) return <LoginScreen />
  if (profileError) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg text-center text-muted">
        <div>
          <p className="mb-3">Couldn't load your profile. Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
            Retry
          </button>
        </div>
      </div>
    )
  }
  if (!profile?.teamId) return <JoinTeamScreen />
  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Resolve the pending target in `VideoReviewPage`**

Edit `app/src/pages/VideoReviewPage.tsx`.

Add the import (after the existing `gameLabel` import):

```tsx
import type { ShareTarget } from '../lib/shareLink'
```

Update the props interface and function signature:

```tsx
interface VideoReviewPageProps {
  nav: React.ReactNode
  pendingTarget: ShareTarget | null
  onPendingTargetHandled: () => void
}
```

```tsx
export function VideoReviewPage({ nav, pendingTarget, onPendingTargetHandled }: VideoReviewPageProps) {
```

Update the top-of-component hook calls to also pull `clips`/loading flags:

```tsx
  const { clips, loading: clipsLoading, createClip, updateClip, findOrCreateFileClip } = useClips()
  const { games, loading: gamesLoading } = useGames()
```

Add new state right after the existing `activeClip` state:

```tsx
  const [initialSeekTime, setInitialSeekTime] = useState<number | undefined>(undefined)
```

In `handleNewSource`, reset the seek time at the top (it only applies to the deep-link path):

```tsx
  const handleNewSource = (newSource: VideoSource) => {
    setInitialSeekTime(undefined)
```

Insert the resolution effect right after the `pendingFileReopen` state declaration (`const [pendingFileReopen, setPendingFileReopen] = useState<Clip | null>(null)`) and before `handleReopenFileSelected`:

```tsx

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
```

In `handleOpenClip`, reset the seek time (a normal click should never carry over a stale deep-link timestamp):

```tsx
  const handleOpenClip = (clip: Clip) => {
    flushPendingClipUpdate()
    setInitialSeekTime(undefined)
    if (clip.sourceType === 'file') {
```

Finally, pass the resolved seek time into the player. Change:

```tsx
          initialTrim={
```

to:

```tsx
          initialSeekTime={initialSeekTime}
          initialTrim={
```

- [ ] **Step 4: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/main.tsx app/src/App.tsx app/src/pages/VideoReviewPage.tsx
git commit -m "Resolve share links into an open game/clip/timestamp on load"
```

---

### Task 4: Share button on each game card

**Files:**
- Modify: `app/src/components/source/GamesLibrary.tsx`

- [ ] **Step 1: Add the share button and copied-confirmation state**

Replace the full file:

```tsx
import { useRef, useState } from 'react'
import { useGames, type Game } from '../../state/gamesStore'
import { useClips } from '../../state/clipsStore'
import { gameLabel } from '../../lib/gameLabel'
import { buildGameShareUrl } from '../../lib/shareLink'
import { CalendarIcon, CheckIcon, PlusIcon, ShareIcon, TrashIcon } from '../icons'
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
  const [copiedGameId, setCopiedGameId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)

  // Clips are already loaded in full by ClipsProvider (used across the whole Video
  // Review flow at once), so counting per game here is a plain client-side reduce —
  // no extra query needed, unlike bookmark counts which come from a table this
  // component doesn't otherwise load.
  const clipCount = (gameId: string | null) => clips.filter((c) => c.gameId === gameId).length

  const handleShare = async (game: Game) => {
    try {
      await navigator.clipboard.writeText(buildGameShareUrl(game.id))
      setCopiedGameId(game.id)
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = window.setTimeout(() => setCopiedGameId(null), 1500)
    } catch (error) {
      console.error('Failed to copy share link', error)
    }
  }

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
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => handleShare(game)} aria-label="Copy link to this game" className="text-muted hover:text-accent-teal">
                {copiedGameId === game.id ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
              </button>
              <button
                onClick={() => {
                  setDeleting(game)
                  setDeleteError(null)
                }}
                aria-label="Delete game"
                className="text-muted hover:text-alert-red"
              >
                <TrashIcon width={14} height={14} />
              </button>
            </div>
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

- [ ] **Step 2: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/GamesLibrary.tsx
git commit -m "Add share button to each game card"
```

---

### Task 5: Final check and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run (from `app/`):

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test 2>&1 | tail -6 && npx oxlint 2>&1 | tail -10
```

Expected: no type errors, all tests pass, no new lint warnings beyond the pre-existing `unicorn(no-thenable)` warnings in test-mock builder files (`gamesStore.test.tsx`, `playbookStore.test.tsx` x2, `bookmarksStore.test.tsx`).

- [ ] **Step 2: Manual browser verification**

With the dev server running and signed in:

1. Open a game with at least one clip that has a bookmark. Click the share icon on the game card — confirm it briefly shows a checkmark, and that pasting the clipboard contents shows a URL like `.../?game=<uuid>`.
2. Open that clip, expand Bookmarks, click the share icon on a bookmarked row — confirm the same checkmark feedback, and the copied URL includes `&clip=<uuid>&t=<seconds>`.
3. Paste the game-level URL into the address bar and reload. Confirm the app lands directly on that game's clip list (not the Games list), with the correct title in the header.
4. Paste the moment-level URL into the address bar and reload. Confirm the app opens that exact clip and seeks to the bookmarked time before playback starts (check the scrub bar position).
5. If the shared clip is a local-file clip, confirm reloading the moment link prompts the native file picker (same as reopening any file clip) rather than erroring.
6. Edit the game id in a copied URL to a random UUID and reload. Confirm the app falls back to the normal Games list instead of showing a broken screen.
7. Confirm normal in-app navigation (clicking through Games → clip → back → back) still works unchanged after visiting a share link in the same session.

- [ ] **Step 3: Report results**

No commit for this task — report the check output and manual verification results.
