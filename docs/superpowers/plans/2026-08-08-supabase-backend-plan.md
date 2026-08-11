# Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real auth (magic link + team join code) and Supabase-backed persistence (formations, categories, plays, video clips) to `app/`, including a new formation editor so formations/categories are genuinely team-editable, not just relocated.

**Architecture:** `@supabase/supabase-js` talks directly from the browser to Supabase (Postgres + Auth), governed entirely by Row Level Security — no server code. `playbookStore` and a new `clipsStore` keep their existing optimistic-local-state pattern (already used for `plays`) but now also persist in the background. The schema, RLS policies, and seed data already exist as SQL migration files in this repo (`supabase/migrations/`) — **the user runs these once in the Supabase SQL Editor**, they are not executed by any task in this plan (no task has the database credentials needed to run them).

**Tech Stack:** `@supabase/supabase-js`, React context providers (matching the existing `PlaybookProvider` pattern), Vitest for pure-function tests.

---

## Prerequisite (not a task — user action)

Before Task 5 (manual verification) can succeed, run both files in the Supabase SQL Editor (Project → SQL Editor → New query), in order:
1. `supabase/migrations/0001_init.sql` — schema, RLS, the `join_team` function, and creates one team with join code `BANTAM-B7X2` (edit the join code in the file first if you want a different one — just keep 0002 in sync).
2. `supabase/migrations/0002_seed.sql` — seeds that team with the app's current built-in formations/categories.

This can happen any time before Task 5; it doesn't block Tasks 1-4 (those only touch application code).

## Scope Check

This plan covers auth, the data layer, and the new formation editor. It does not cover: self-serve team creation (out of scope per the design spec — one team, seeded via SQL), Google Drive OAuth (still a UI stub), or Vercel deployment (separate follow-up once this is verified working locally).

## File Structure

```
app/
├── .env.local                          # ALREADY CREATED — Supabase URL + publishable key (gitignored)
├── src/
│   ├── lib/supabaseClient.ts           # NEW
│   ├── auth/
│   │   ├── AuthProvider.tsx            # NEW — session + profile + team name
│   │   ├── LoginScreen.tsx             # NEW — magic link request
│   │   └── JoinTeamScreen.tsx          # NEW — join-code entry
│   ├── state/
│   │   ├── playbookStore.tsx           # MODIFIED — Supabase-backed, +createFormation/+createCategory
│   │   ├── playbookStore.mappers.ts    # NEW — pure row→app-type functions, extracted for testability
│   │   ├── playbookStore.mappers.test.ts  # NEW
│   │   ├── clipsStore.tsx              # NEW
│   │   ├── clipsStore.mappers.ts       # NEW
│   │   └── clipsStore.mappers.test.ts  # NEW
│   ├── components/
│   │   ├── templates/
│   │   │   ├── FormationCanvas.tsx     # NEW — self-contained add/select/drag field editor
│   │   │   ├── FormationEditorView.tsx # NEW
│   │   │   ├── NewCategoryModal.tsx    # NEW
│   │   │   ├── FormationsGallery.tsx   # MODIFIED — unit-aware, "+ New Formation" wired up
│   │   │   └── TemplatesView.tsx       # MODIFIED — unit-aware, view-switches to the editor
│   │   ├── playbook/PlaybookListView.tsx  # MODIFIED — passes current unit to onOpenTemplates
│   │   └── source/ClipLibrary.tsx      # NEW
│   ├── components/player/VideoPlayerPage.tsx  # MODIFIED — additive props: initialTrim, initialStrokes, onStateChange
│   ├── pages/
│   │   ├── PlaybookPage.tsx            # MODIFIED — tracks which unit templates/editor targets
│   │   └── VideoReviewPage.tsx         # MODIFIED — clip library instead of always-picker
│   └── App.tsx                         # MODIFIED — auth gate (loading → login → join-team → app), wraps ClipsProvider
```

---

### Task 1: Auth infrastructure

**Files:**
- Create: `app/src/lib/supabaseClient.ts`
- Create: `app/src/auth/AuthProvider.tsx`
- Create: `app/src/auth/LoginScreen.tsx`
- Create: `app/src/auth/JoinTeamScreen.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Install the Supabase client**

Run: `cd app && npm install @supabase/supabase-js`
Expected: added to `dependencies` in `package.json`, 0 vulnerabilities.

- [ ] **Step 2: Write the Supabase client module**

Write `app/src/lib/supabaseClient.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables')
}

export const supabase = createClient(url, publishableKey)
```

`app/.env.local` already exists with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set (created outside this plan, gitignored via the `*.local` pattern in `app/.gitignore` — verify with `git check-ignore -v app/.env.local` if you want to confirm, but do not create, edit, or commit this file as part of this task).

- [ ] **Step 3: Write the auth provider**

Write `app/src/auth/AuthProvider.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface Profile {
  id: string
  teamId: string | null
  displayName: string | null
}

interface AuthContextValue {
  loading: boolean
  session: Session | null
  profile: Profile | null
  teamName: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, team_id, display_name').eq('id', userId).single()
  if (error || !data) return null
  return { id: data.id, teamId: data.team_id, displayName: data.display_name }
}

async function loadTeamName(teamId: string): Promise<string | null> {
  const { data, error } = await supabase.from('teams').select('name').eq('id', teamId).single()
  if (error || !data) return null
  return data.name
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)

  const applySession = useCallback(async (newSession: Session | null) => {
    setSession(newSession)
    if (!newSession) {
      setProfile(null)
      setTeamName(null)
      return
    }
    const p = await loadProfile(newSession.user.id)
    setProfile(p)
    setTeamName(p?.teamId ? await loadTeamName(p.teamId) : null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await applySession(data.session)
  }, [applySession])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      await applySession(data.session)
      if (!cancelled) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await applySession(newSession)
      setLoading(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ loading, session, profile, teamName, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Write the login screen**

Write `app/src/auth/LoginScreen.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-4 text-lg font-bold text-text">Sign in</h1>
        {sent ? (
          <p className="text-sm text-muted">
            Check <span className="text-text">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mb-3 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-teal"
            />
            {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write the join-team screen**

Write `app/src/auth/JoinTeamScreen.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

export function JoinTeamScreen() {
  const { refreshProfile, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    setError(null)
    const { error } = await supabase.rpc('join_team', { p_join_code: code.trim() })
    setJoining(false)
    if (error) {
      setError('That code was not recognized. Double-check with your coach.')
      return
    }
    await refreshProfile()
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-2 text-lg font-bold text-text">Join your team</h1>
        <p className="mb-4 text-sm text-muted">Enter the join code your coach shared with you.</p>
        <form onSubmit={handleSubmit}>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. BANTAM-B7X2"
            className="mb-3 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm uppercase outline-none focus:border-accent-teal"
          />
          {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
          <button
            type="submit"
            disabled={joining}
            className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join team'}
          </button>
        </form>
        <button onClick={signOut} className="mt-3 w-full text-center text-xs text-muted hover:text-text">
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire the auth gate into App.tsx**

Write `app/src/App.tsx`:
```tsx
import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { JoinTeamScreen } from './auth/JoinTeamScreen'
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

function AuthenticatedApp() {
  const [section, setSection] = useState<Section>('video')
  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
    </PlaybookProvider>
  )
}

function Gate() {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-app-bg text-muted">Loading…</div>
  }
  if (!session) return <LoginScreen />
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

(`ClipsProvider` is added around `AuthenticatedApp` in Task 4, once it exists — don't add it yet, it doesn't exist until then and this step would fail to compile if you tried.)

- [ ] **Step 7: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 8: Verify the existing test suite still passes**

Run: `cd app && npm test`
Expected: `15 passed` (unchanged — this task adds no new tests; auth flows are covered by Task 5's manual verification instead, since they require a real Supabase project and a real magic-link email round-trip that can't be meaningfully unit-tested).

- [ ] **Step 9: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/lib/supabaseClient.ts app/src/auth/ app/src/App.tsx app/package.json app/package-lock.json
git commit -m "Add Supabase auth: magic link sign-in and team join-code gate"
```

---

### Task 2: Supabase-backed playbook store

**Files:**
- Create: `app/src/state/playbookStore.mappers.ts`
- Create: `app/src/state/playbookStore.mappers.test.ts`
- Modify: `app/src/state/playbookStore.tsx`

- [ ] **Step 1: Write the row-mapping functions as a separate, testable module**

Write `app/src/state/playbookStore.mappers.ts`:
```ts
import type { Category, Formation, Play } from '../types/play'

export interface FormationRow {
  id: string
  unit: string
  name: string
  players: Formation['players']
}
export interface CategoryRow {
  id: string
  unit: string
  name: string
}
export interface PlayRow {
  id: string
  unit: string
  formation_id: string
  category_id: string
  name: string
  players: Play['players']
  annotations: Play['annotations']
  position_notes: Play['positionNotes']
}

export function rowToFormation(row: FormationRow): Formation {
  return { id: row.id, name: row.name, unit: row.unit as Formation['unit'], players: row.players ?? [] }
}

export function rowToCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, unit: row.unit as Category['unit'] }
}

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
  }
}

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
  }
}

export function playToUpdateRow(play: Play) {
  return {
    name: play.name,
    players: play.players,
    annotations: play.annotations,
    position_notes: play.positionNotes,
    category_id: play.categoryId,
    updated_at: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Write tests for the mappers**

Write `app/src/state/playbookStore.mappers.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { rowToCategory, rowToFormation, rowToPlay, playToInsertRow, playToUpdateRow } from './playbookStore.mappers'
import type { Play } from '../types/play'

describe('rowToFormation', () => {
  it('maps a DB row to the app Formation shape', () => {
    const row = { id: '1', unit: 'offense', name: 'I Right', players: [{ id: 'X', label: 'X', role: 'skill' as const, x: 12, y: 30 }] }
    expect(rowToFormation(row)).toEqual({ id: '1', name: 'I Right', unit: 'offense', players: row.players })
  })

  it('defaults players to an empty array when null', () => {
    const row = { id: '1', unit: 'offense', name: 'Empty', players: null as unknown as [] }
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
    })
  })

  it('defaults jsonb columns to empty values when null', () => {
    const row = { id: '1', unit: 'offense', formation_id: 'f1', category_id: 'c1', name: 'Play 1', players: null as any, annotations: null as any, position_notes: null as any }
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
  }

  it('playToInsertRow includes team_id and snake_case columns', () => {
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
    })
  })

  it('playToUpdateRow omits id/team_id and includes updated_at', () => {
    const row = playToUpdateRow(play)
    expect(row).toMatchObject({ name: 'Play 1', players: [], annotations: [], position_notes: {}, category_id: 'c1' })
    expect(row.updated_at).toEqual(expect.any(String))
  })
})
```

- [ ] **Step 3: Run the new tests**

Run: `cd app && npm test -- playbookStore.mappers`
Expected: `8 passed`

- [ ] **Step 4: Rewrite playbookStore.tsx to be Supabase-backed**

This replaces the static `FORMATIONS`/`CATEGORIES` arrays with data fetched from Supabase, scoped automatically by RLS (no client-side `team_id` filtering needed on reads — only on writes, per the mappers above). `createPlay`/`updatePlay` keep their existing **synchronous** signatures (optimistic local update + fire-and-forget background persist) so no caller in `NewPlayModal.tsx` or `PlayEditorView.tsx` needs to change. `createFormation`/`createCategory` are new and **async** (their only callers are new components in Task 3, written to `await` them).

Write `app/src/state/playbookStore.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import type { Category, Formation, Play, Unit } from '../types/play'
import { playToInsertRow, playToUpdateRow, rowToCategory, rowToFormation, rowToPlay } from './playbookStore.mappers'

interface PlaybookContextValue {
  teamName: string
  loading: boolean
  formations: Formation[]
  categories: Category[]
  plays: Play[]
  formationsForUnit: (unit: Unit) => Formation[]
  categoriesForUnit: (unit: Unit) => Category[]
  createPlay: (input: { name: string; unit: Unit; formationId: string; categoryId: string; positionNotes: Record<string, string> }) => Play
  updatePlay: (play: Play) => void
  createFormation: (input: { name: string; unit: Unit; players: Formation['players'] }) => Promise<Formation>
  createCategory: (input: { name: string; unit: Unit }) => Promise<Category>
  getFormation: (id: string) => Formation | undefined
}

const PlaybookContext = createContext<PlaybookContextValue | null>(null)

export function PlaybookProvider({ children }: { children: ReactNode }) {
  const { profile, teamName: authTeamName } = useAuth()
  const teamId = profile?.teamId ?? null
  const [formations, setFormations] = useState<Formation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [plays, setPlays] = useState<Play[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('formations').select('*').order('created_at'),
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('plays').select('*').order('created_at'),
    ]).then(([f, c, p]) => {
      if (cancelled) return
      if (f.data) setFormations(f.data.map(rowToFormation))
      if (c.data) setCategories(c.data.map(rowToCategory))
      if (p.data) setPlays(p.data.map(rowToPlay))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const formationsForUnit = useCallback((unit: Unit) => formations.filter((f) => f.unit === unit), [formations])
  const categoriesForUnit = useCallback((unit: Unit) => categories.filter((c) => c.unit === unit), [categories])
  const getFormation = useCallback((id: string) => formations.find((f) => f.id === id), [formations])

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
      setPlays((prev) => [...prev, play])
      if (teamId) {
        supabase
          .from('plays')
          .insert(playToInsertRow(play, teamId))
          .then(({ error }) => {
            if (error) console.error('Failed to persist new play', error)
          })
      }
      return play
    },
    [formations, teamId],
  )

  const updatePlay: PlaybookContextValue['updatePlay'] = useCallback((play: Play) => {
    setPlays((prev) => prev.map((p) => (p.id === play.id ? play : p)))
    supabase
      .from('plays')
      .update(playToUpdateRow(play))
      .eq('id', play.id)
      .then(({ error }) => {
        if (error) console.error('Failed to persist play update', error)
      })
  }, [])

  const createFormation: PlaybookContextValue['createFormation'] = useCallback(
    async ({ name, unit, players }) => {
      if (!teamId) throw new Error('No team')
      const { data, error } = await supabase.from('formations').insert({ team_id: teamId, unit, name, players }).select().single()
      if (error || !data) throw error ?? new Error('Failed to create formation')
      const formation = rowToFormation(data)
      setFormations((prev) => [...prev, formation])
      return formation
    },
    [teamId],
  )

  const createCategory: PlaybookContextValue['createCategory'] = useCallback(
    async ({ name, unit }) => {
      if (!teamId) throw new Error('No team')
      const { data, error } = await supabase.from('categories').insert({ team_id: teamId, unit, name }).select().single()
      if (error || !data) throw error ?? new Error('Failed to create category')
      const category = rowToCategory(data)
      setCategories((prev) => [...prev, category])
      return category
    },
    [teamId],
  )

  const value = useMemo<PlaybookContextValue>(
    () => ({
      teamName: authTeamName ?? 'Your Team',
      loading,
      formations,
      categories,
      plays,
      formationsForUnit,
      categoriesForUnit,
      createPlay,
      updatePlay,
      createFormation,
      createCategory,
      getFormation,
    }),
    [authTeamName, loading, formations, categories, plays, formationsForUnit, categoriesForUnit, createPlay, updatePlay, createFormation, createCategory, getFormation],
  )

  return <PlaybookContext.Provider value={value}>{children}</PlaybookContext.Provider>
}

export function usePlaybook() {
  const ctx = useContext(PlaybookContext)
  if (!ctx) throw new Error('usePlaybook must be used within PlaybookProvider')
  return ctx
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. (`PlaybookProvider` now calls `useAuth()`, so it must be rendered inside `AuthProvider` — it already is, via `App.tsx`'s `AuthenticatedApp`, which only renders once `Gate` has confirmed a session and team exist.)

- [ ] **Step 6: Run the full test suite**

Run: `cd app && npm test`
Expected: `23 passed` (15 existing + 8 new mapper tests). The existing `playbookStore.test.tsx` (3 tests using `renderHook` against `PlaybookProvider` directly, without wrapping in `AuthProvider`) will now fail, because `PlaybookProvider` calls `useAuth()` which throws outside an `AuthProvider`. Fix this: modify `app/src/state/playbookStore.test.tsx`'s `wrapper` to also mock `useAuth` — add this to the top of the file, above the existing imports:
```tsx
import { vi } from 'vitest'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' }, teamName: 'Test Team' }),
}))
```
This makes the existing 3 tests exercise `PlaybookProvider`'s local-state behavior (`createPlay`/`updatePlay`) without needing a real Supabase connection — the `supabase.from(...).insert(...)` background call will be attempted and fail (no real network in the test environment), but since `createPlay`/`updatePlay` don't await it, the test's assertions on local state aren't affected. Confirm this by re-running: `cd app && npm test -- playbookStore` should show `3 passed` (the original 3, now passing again) plus no unhandled-rejection failures.

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/playbookStore.tsx app/src/state/playbookStore.mappers.ts app/src/state/playbookStore.mappers.test.ts app/src/state/playbookStore.test.tsx
git commit -m "Make playbookStore Supabase-backed with row mappers and tests"
```

---

### Task 3: Formation editor and category creation

**Files:**
- Create: `app/src/components/templates/FormationCanvas.tsx`
- Create: `app/src/components/templates/FormationEditorView.tsx`
- Create: `app/src/components/templates/NewCategoryModal.tsx`
- Modify: `app/src/components/templates/FormationsGallery.tsx`
- Modify: `app/src/components/templates/TemplatesView.tsx`
- Modify: `app/src/components/playbook/PlaybookListView.tsx`
- Modify: `app/src/pages/PlaybookPage.tsx`

- [ ] **Step 1: Write a self-contained field canvas for the formation editor**

This is deliberately **not** a modification of the existing `FieldCanvas`/`PlayerToken` (used by the already-tested `PlayEditorView`) — it's a new, isolated component with its own add/select/drag interaction, so there's zero risk to the route-drawing editor. Some rendering code is duplicated from `PlayerToken.tsx`; that's an accepted tradeoff for isolation here, not an oversight.

Write `app/src/components/templates/FormationCanvas.tsx`:
```tsx
import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { Formation } from '../../types/play'

const YARD_LINES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

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

export function FormationCanvas({ players, selectedId, armed, onAddPlayer, onSelectPlayer, onMovePlayer }: FormationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)

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
    if (!armed || dragRef.current) return
    onAddPlayer(pointFromEvent(e))
  }

  const handleTokenMouseDown = (id: string) => (e: ReactMouseEvent) => {
    e.stopPropagation()
    dragRef.current = { id, moved: false }
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
      {YARD_LINES.map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#3a434d" strokeWidth={0.15} />
      ))}
      <line x1={0} y1={30} x2={100} y2={30} stroke="#5a6470" strokeWidth={0.25} />

      {players.map((p) => {
        const color = ROLE_COLOR[p.role]
        const isLineman = p.role === 'lineman'
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} onMouseDown={handleTokenMouseDown(p.id)} style={{ cursor: 'grab' }}>
            {isLineman ? (
              <rect x={-1.6} y={-1.6} width={3.2} height={3.2} fill="none" stroke={color} strokeWidth={0.3} />
            ) : (
              <circle r={1.8} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
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

- [ ] **Step 2: Write the formation editor page**

Write `app/src/components/templates/FormationEditorView.tsx`:
```tsx
import { useState } from 'react'
import type { Formation, PlayerRole, Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { AppShell } from '../layout/AppShell'
import { TrashIcon } from '../icons'
import { FormationCanvas } from './FormationCanvas'

interface FormationEditorViewProps {
  unit: Unit
  nav?: React.ReactNode
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

export function FormationEditorView({ unit, nav, onBack }: FormationEditorViewProps) {
  const { createFormation } = usePlaybook()
  const [name, setName] = useState('New Formation')
  const [players, setPlayers] = useState<Formation['players']>([])
  const [armedRole, setArmedRole] = useState<PlayerRole | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions = ROLE_OPTIONS[unit]

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

  const handleSave = async () => {
    if (!name.trim() || players.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await createFormation({ name: name.trim(), unit, players })
      onBack()
    } catch {
      setError('Could not save this formation. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="New Formation" subtitle={unit} onBack={onBack} nav={nav}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-panel px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
        />
        {error && <span className="text-xs text-alert-red">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || players.length === 0}
          className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
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
      <div className="relative" style={{ height: 'calc(100% - 116px)' }}>
        <FormationCanvas
          players={players}
          selectedId={selectedId}
          armed={armedRole !== null}
          onAddPlayer={addPlayer}
          onSelectPlayer={(id) => {
            setSelectedId(id)
            setArmedRole(null)
          }}
          onMovePlayer={movePlayer}
        />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Write a minimal new-category modal**

Write `app/src/components/templates/NewCategoryModal.tsx`:
```tsx
import { useState } from 'react'
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { CheckIcon, NoIcon } from '../icons'

interface NewCategoryModalProps {
  unit: Unit
  onClose: () => void
}

export function NewCategoryModal({ unit, onClose }: NewCategoryModalProps) {
  const { createCategory } = usePlaybook()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createCategory({ name: name.trim(), unit })
      onClose()
    } catch {
      setError('Could not save this category. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">New Category</span>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="text-accent-teal disabled:opacity-40" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
          />
          {error && <p className="mt-2 text-xs text-alert-red">{error}</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Make FormationsGallery unit-aware and wire up "New Formation"**

Read the current `app/src/components/templates/FormationsGallery.tsx` first. Replace it with:
```tsx
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { FieldCanvas } from '../editor/FieldCanvas'

interface FormationsGalleryProps {
  unit: Unit
  onNewFormation: () => void
}

export function FormationsGallery({ unit, onNewFormation }: FormationsGalleryProps) {
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
        <div key={f.id} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
          <div className="flex-1" style={{ backgroundImage: 'radial-gradient(#2a333c 1px, transparent 1px)', backgroundSize: '6px 6px' }}>
            <FieldCanvas players={f.players.map((p) => ({ ...p, route: [] }))} readOnly />
          </div>
          <div className="px-2 pb-2 text-sm">{f.name}</div>
        </div>
      ))}
    </div>
  )
}
```
(Changes from the current file: `unit` and `onNewFormation` props replace the hardcoded `'offense'` and the dead placeholder button; everything else — the field rendering — is unchanged.)

- [ ] **Step 5: Make TemplatesView unit-aware and add a category-creation entry point**

Read the current `app/src/components/templates/TemplatesView.tsx` first. Replace it with:
```tsx
import { useState } from 'react'
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { AppShell } from '../layout/AppShell'
import { FormationEditorView } from './FormationEditorView'
import { FormationsGallery } from './FormationsGallery'
import { NewCategoryModal } from './NewCategoryModal'
import { RouteTreeGallery } from './RouteTreeGallery'
import { PlusIcon } from '../icons'

interface TemplatesViewProps {
  unit: Unit
  nav?: React.ReactNode
  onBack: () => void
}

const UNIT_LABEL: Record<Unit, string> = { offense: 'Offensive', defense: 'Defensive', specialTeams: 'Special Teams' }

export function TemplatesView({ unit, nav, onBack }: TemplatesViewProps) {
  const { categoriesForUnit } = usePlaybook()
  const [tab, setTab] = useState<'formations' | 'categories' | 'routeTree'>('formations')
  const [editingFormation, setEditingFormation] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)

  if (editingFormation) {
    return <FormationEditorView unit={unit} nav={nav} onBack={() => setEditingFormation(false)} />
  }

  return (
    <AppShell title={`${UNIT_LABEL[unit]} Templates`} onBack={onBack} nav={nav}>
      <div className="flex bg-panel text-sm font-bold uppercase tracking-wide">
        <button
          onClick={() => setTab('formations')}
          className={`flex-1 py-3 ${tab === 'formations' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Formations
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`flex-1 py-3 ${tab === 'categories' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
        >
          Categories
        </button>
        {unit === 'offense' && (
          <button
            onClick={() => setTab('routeTree')}
            className={`flex-1 py-3 ${tab === 'routeTree' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
          >
            Route Tree
          </button>
        )}
      </div>
      {tab === 'formations' && <FormationsGallery unit={unit} onNewFormation={() => setEditingFormation(true)} />}
      {tab === 'categories' && (
        <div className="p-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {categoriesForUnit(unit).map((c) => (
              <span key={c.id} className="rounded-standard bg-panel px-3 py-1.5 text-sm text-text">
                {c.name}
              </span>
            ))}
          </div>
          <button
            onClick={() => setAddingCategory(true)}
            className="flex items-center gap-2 rounded-standard border border-dashed border-white/15 px-3 py-2 text-sm text-muted hover:border-accent-teal hover:text-text"
          >
            <PlusIcon width={16} height={16} /> New Category
          </button>
        </div>
      )}
      {tab === 'routeTree' && <RouteTreeGallery />}
      {addingCategory && <NewCategoryModal unit={unit} onClose={() => setAddingCategory(false)} />}
    </AppShell>
  )
}
```
(The Route Tree gallery stays offense-only, matching what it's always been — no route-tree content exists for defense/special-teams presets, so it's hidden for those units rather than shown empty.)

- [ ] **Step 6: Pass the active unit from PlaybookListView through to templates**

Read the current `app/src/components/playbook/PlaybookListView.tsx` first. Its `onOpenTemplates` prop currently takes no arguments (`onOpenTemplates: () => void`) and is called from the "Edit Formations"/"Edit Categories" button with no arguments. Change the prop type to `onOpenTemplates: (unit: Unit) => void` (import `Unit` from `'../../types/play'` if not already imported) and change the call site to pass the view's current `unit` state variable: find `onEdit={onOpenTemplates}` (passed to `FormationList`) and change it to `onEdit={() => onOpenTemplates(unit)}`.

- [ ] **Step 7: Update PlaybookPage to track and pass the active unit**

Write `app/src/pages/PlaybookPage.tsx`:
```tsx
import { useState } from 'react'
import type { Unit } from '../types/play'
import { PlayEditorView } from '../components/editor/PlayEditorView'
import { PlaybookListView } from '../components/playbook/PlaybookListView'
import { TemplatesView } from '../components/templates/TemplatesView'

type View = { name: 'list' } | { name: 'editor'; playId: string } | { name: 'templates'; unit: Unit }

interface PlaybookPageProps {
  nav: React.ReactNode
}

export function PlaybookPage({ nav }: PlaybookPageProps) {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'editor') {
    return <PlayEditorView nav={nav} playId={view.playId} onBack={() => setView({ name: 'list' })} />
  }
  if (view.name === 'templates') {
    return <TemplatesView nav={nav} unit={view.unit} onBack={() => setView({ name: 'list' })} />
  }
  return (
    <PlaybookListView
      nav={nav}
      onOpenPlay={(playId) => setView({ name: 'editor', playId })}
      onOpenTemplates={(unit) => setView({ name: 'templates', unit })}
    />
  )
}
```

- [ ] **Step 8: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 9: Run the full test suite**

Run: `cd app && npm test`
Expected: `23 passed` (unchanged from Task 2 — this task adds no new automated tests; the formation editor's drag/add/select interaction is covered by Task 5's manual verification, matching how the original click-to-place-waypoint route drawing was verified).

- [ ] **Step 10: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/components/templates/ app/src/components/playbook/PlaybookListView.tsx app/src/pages/PlaybookPage.tsx
git commit -m "Add formation editor and category creation, wired to Supabase"
```

---

### Task 4: Video clip library

**Files:**
- Create: `app/src/state/clipsStore.mappers.ts`
- Create: `app/src/state/clipsStore.mappers.test.ts`
- Create: `app/src/state/clipsStore.tsx`
- Create: `app/src/components/source/ClipLibrary.tsx`
- Modify: `app/src/components/player/VideoPlayerPage.tsx`
- Modify: `app/src/pages/VideoReviewPage.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Write the clip row mappers**

Write `app/src/state/clipsStore.mappers.ts`:
```ts
import type { Stroke } from '../types/video'

export type ClipSourceType = 'youtube' | 'drive'

export interface Clip {
  id: string
  sourceType: ClipSourceType
  sourceRef: string
  title: string | null
  inPoint: number | null
  outPoint: number | null
  drawingStrokes: Stroke[]
}

export interface ClipRow {
  id: string
  source_type: string
  source_ref: string
  title: string | null
  in_point: number | null
  out_point: number | null
  drawing_strokes: Stroke[]
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
  }
}

export function clipToInsertRow(clip: Clip, teamId: string) {
  return {
    id: clip.id,
    team_id: teamId,
    source_type: clip.sourceType,
    source_ref: clip.sourceRef,
    title: clip.title,
  }
}

export function clipToUpdateRow(clip: Clip) {
  return {
    title: clip.title,
    in_point: clip.inPoint,
    out_point: clip.outPoint,
    drawing_strokes: clip.drawingStrokes,
  }
}
```

- [ ] **Step 2: Write tests for the clip mappers**

Write `app/src/state/clipsStore.mappers.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { clipToInsertRow, clipToUpdateRow, rowToClip } from './clipsStore.mappers'

describe('rowToClip', () => {
  it('maps a DB row to the app Clip shape', () => {
    const row = { id: '1', source_type: 'youtube', source_ref: 'abc123', title: 'Week 1', in_point: 2.5, out_point: 8, drawing_strokes: [] }
    expect(rowToClip(row)).toEqual({
      id: '1',
      sourceType: 'youtube',
      sourceRef: 'abc123',
      title: 'Week 1',
      inPoint: 2.5,
      outPoint: 8,
      drawingStrokes: [],
    })
  })

  it('defaults drawing_strokes to an empty array when null', () => {
    const row = { id: '1', source_type: 'youtube', source_ref: 'abc123', title: null, in_point: null, out_point: null, drawing_strokes: null as any }
    expect(rowToClip(row).drawingStrokes).toEqual([])
  })
})

describe('clipToInsertRow / clipToUpdateRow', () => {
  const clip = { id: '1', sourceType: 'youtube' as const, sourceRef: 'abc123', title: 'Week 1', inPoint: null, outPoint: null, drawingStrokes: [] }

  it('clipToInsertRow includes team_id and snake_case columns', () => {
    expect(clipToInsertRow(clip, 'team-1')).toEqual({
      id: '1',
      team_id: 'team-1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: 'Week 1',
    })
  })

  it('clipToUpdateRow maps trim points and drawings', () => {
    const withTrim = { ...clip, inPoint: 2, outPoint: 9 }
    expect(clipToUpdateRow(withTrim)).toEqual({ title: 'Week 1', in_point: 2, out_point: 9, drawing_strokes: [] })
  })
})
```

- [ ] **Step 3: Run the new tests**

Run: `cd app && npm test -- clipsStore.mappers`
Expected: `4 passed`

- [ ] **Step 4: Write the clips store**

Write `app/src/state/clipsStore.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { clipToInsertRow, clipToUpdateRow, rowToClip, type Clip, type ClipSourceType } from './clipsStore.mappers'

export type { Clip } from './clipsStore.mappers'

interface ClipsContextValue {
  loading: boolean
  clips: Clip[]
  createClip: (input: { sourceType: ClipSourceType; sourceRef: string; title?: string | null }) => Clip
  updateClip: (clip: Clip) => void
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
    ({ sourceType, sourceRef, title }) => {
      const clip: Clip = { id: crypto.randomUUID(), sourceType, sourceRef, title: title ?? null, inPoint: null, outPoint: null, drawingStrokes: [] }
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

  const value = useMemo<ClipsContextValue>(() => ({ loading, clips, createClip, updateClip }), [loading, clips, createClip, updateClip])

  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>
}

export function useClips() {
  const ctx = useContext(ClipsContext)
  if (!ctx) throw new Error('useClips must be used within ClipsProvider')
  return ctx
}
```

- [ ] **Step 5: Write the clip library screen**

Write `app/src/components/source/ClipLibrary.tsx`:
```tsx
import { useClips, type Clip } from '../../state/clipsStore'
import { PlusIcon, YoutubeIcon, DriveIcon } from '../icons'

interface ClipLibraryProps {
  onOpenClip: (clip: Clip) => void
  onAddNew: () => void
}

export function ClipLibrary({ onOpenClip, onAddNew }: ClipLibraryProps) {
  const { loading, clips } = useClips()

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={onAddNew}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add video</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading clips…</p>}
        {clips.map((clip) => (
          <button
            key={clip.id}
            onClick={() => onOpenClip(clip)}
            className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
          >
            <div className="flex items-center gap-2 text-muted">
              {clip.sourceType === 'youtube' ? <YoutubeIcon width={16} height={16} /> : <DriveIcon width={16} height={16} />}
              <span className="text-[10px] uppercase">{clip.sourceType}</span>
            </div>
            <div className="truncate text-sm text-text">{clip.title || clip.sourceRef}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add optional persistence hooks to VideoPlayerPage**

Read the current `app/src/components/player/VideoPlayerPage.tsx` first. This is an **additive** change — three new optional props default to `undefined`/unused, so the existing local-file playback path (which never passes them) is behaviorally unchanged. Apply these edits:

Change the props interface from:
```tsx
interface VideoPlayerPageProps {
  source: VideoSource
}
```
to:
```tsx
interface VideoPlayerPageProps {
  source: VideoSource
  initialTrim?: { inPoint: number; outPoint: number }
  initialStrokes?: Stroke[]
  onStateChange?: (state: { inPoint: number; outPoint: number; drawingStrokes: Stroke[] }) => void
}
```

Change the function signature and the three relevant `useState` initializers from:
```tsx
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
```
to:
```tsx
export function VideoPlayerPage({ source, initialTrim, initialStrokes, onStateChange }: VideoPlayerPageProps) {
  const controllerRef = useRef<MediaController>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [inPoint, setInPoint] = useState(initialTrim?.inPoint ?? 0)
  const [outPoint, setOutPoint] = useState(initialTrim?.outPoint ?? 0)
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes ?? [])
```

Then add a new effect right after the existing `useEffect(() => { if (playing) loopingBackRef.current = false }, [playing])` block:
```tsx
  useEffect(() => {
    onStateChange?.({ inPoint, outPoint, drawingStrokes: strokes })
  }, [inPoint, outPoint, strokes, onStateChange])
```

- [ ] **Step 7: Rewrite VideoReviewPage to show the clip library**

Write `app/src/pages/VideoReviewPage.tsx`:
```tsx
import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import { ClipLibrary } from '../components/source/ClipLibrary'
import { useClips, type Clip } from '../state/clipsStore'
import type { VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
}

function clipToSource(clip: Clip): VideoSource {
  if (clip.sourceType === 'youtube') return { type: 'youtube', url: clip.sourceRef, youtubeId: clip.sourceRef }
  return { type: 'drive', url: clip.sourceRef }
}

type Mode = 'library' | 'add' | 'player'

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const { createClip, updateClip } = useClips()
  const [mode, setMode] = useState<Mode>('library')
  const [source, setSource] = useState<VideoSource | null>(null)
  const [activeClip, setActiveClip] = useState<Clip | null>(null)

  const handleNewSource = (newSource: VideoSource) => {
    if (newSource.type === 'file') {
      // Local files can't be referenced from Supabase (the bytes never leave the browser),
      // so they're never saved to the clip library — just play them directly.
      setActiveClip(null)
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

  const handleOpenClip = (clip: Clip) => {
    setActiveClip(clip)
    setSource(clipToSource(clip))
    setMode('player')
  }

  const handleBack = () => {
    setSource(null)
    setActiveClip(null)
    setMode('library')
  }

  return (
    <AppShell title="Video Review" nav={nav} onBack={mode !== 'library' ? handleBack : undefined}>
      {mode === 'library' && <ClipLibrary onOpenClip={handleOpenClip} onAddNew={() => setMode('add')} />}
      {mode === 'add' && <VideoSourceModal onSelect={handleNewSource} />}
      {mode === 'player' && source && (
        <VideoPlayerPage
          source={source}
          initialTrim={activeClip?.inPoint != null && activeClip?.outPoint != null ? { inPoint: activeClip.inPoint, outPoint: activeClip.outPoint } : undefined}
          initialStrokes={activeClip?.drawingStrokes}
          onStateChange={activeClip ? (state) => updateClip({ ...activeClip, ...state }) : undefined}
        />
      )}
    </AppShell>
  )
}
```

- [ ] **Step 8: Wrap the app with ClipsProvider**

Modify `app/src/App.tsx` — add the import and wrap `AuthenticatedApp`'s return value. Change:
```tsx
import { PlaybookProvider } from './state/playbookStore'
```
to:
```tsx
import { PlaybookProvider } from './state/playbookStore'
import { ClipsProvider } from './state/clipsStore'
```
and change:
```tsx
  return (
    <PlaybookProvider>
      {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
    </PlaybookProvider>
  )
```
to:
```tsx
  return (
    <PlaybookProvider>
      <ClipsProvider>
        {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
      </ClipsProvider>
    </PlaybookProvider>
  )
```

- [ ] **Step 9: Verify it compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 10: Run the full test suite**

Run: `cd app && npm test`
Expected: `27 passed` (23 from Task 2/3 + 4 new clip mapper tests).

- [ ] **Step 11: Commit**

```bash
cd ~/Projects/football-coach-app
git add app/src/state/clipsStore.tsx app/src/state/clipsStore.mappers.ts app/src/state/clipsStore.mappers.test.ts app/src/components/source/ClipLibrary.tsx app/src/components/player/VideoPlayerPage.tsx app/src/pages/VideoReviewPage.tsx app/src/App.tsx
git commit -m "Add video clip library backed by Supabase"
```

---

### Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the migrations have been run**

Ask the user to confirm `supabase/migrations/0001_init.sql` and `0002_seed.sql` have been run in the Supabase SQL Editor (see "Prerequisite" at the top of this plan). If not yet run, stop here and wait — the rest of this task will fail without them.

- [ ] **Step 2: Start the dev server**

Run: `cd app && npm run dev -- --port 5200`
Expected: `VITE ... ready`, `Local: http://localhost:5200/`

- [ ] **Step 3: Sign in with a real email**

In a browser at `http://localhost:5200`: enter a real, checkable email address, click "Send sign-in link", check that inbox, click the link. Confirm it lands back on the app authenticated (past the loading screen, no longer showing the login form).

- [ ] **Step 4: Join the team**

Confirm the "Join your team" screen appears (first-time user, no team yet). Enter the join code from `0001_init.sql` (`BANTAM-B7X2` unless it was changed). Confirm it proceeds to the main app (Video Review / Playbook nav visible).

- [ ] **Step 5: Verify Playbook loads seeded data**

Click "Playbook". Confirm the Offense formations list shows `I Right, Split Right, Deuce, Duo` with counts, matching what the app showed before this backend existed — this proves the seed data landed and RLS is scoping reads correctly.

- [ ] **Step 6: Create a new category**

From the playbook list, click "Edit Categories" (via the Categories tab + "Edit Formations"/category flow), then "New Category", name it something new (e.g. "Blitz"), save. Confirm it appears in the categories list. Reload the page — confirm it's still there (proves the write persisted, not just local state).

- [ ] **Step 7: Create a new formation**

From Templates → Formations, click "+ New Formation". Arm a role (e.g. "Skill"), click the field to place 2-3 players, drag one to reposition it, select another and delete it. Name the formation, click Save. Confirm it appears in the formations gallery with the correct player layout. Reload the page — confirm it's still there.

- [ ] **Step 8: Create a play using the new formation**

Create a new offensive play using the formation just created. Draw a route on one of its players. Go back to the list, confirm the play thumbnail shows the route. Reload the page — confirm the play, its formation, and its route all persisted.

- [ ] **Step 9: Add a YouTube clip and verify persistence**

Go to Video Review — confirm it now shows a clip library (not an immediate source picker). Click "Add video", load a YouTube URL (e.g. `https://www.youtube.com/watch?v=aqz-KE-bpKQ`). Set an in point and an out point, draw a stroke. Go back to the library — confirm the clip is listed. Reload the page, open that clip from the library — confirm the in/out points and the drawing were restored.

- [ ] **Step 10: Check for console errors**

Check the browser console throughout the above. Expected: no errors (some Supabase informational logs are fine, but no red errors).

- [ ] **Step 11: Stop the dev server**

No commit for this task — it's verification only. If any issue was found and fixed during this step, that fix should already have been committed as part of whichever task's file it touched; if it revealed a gap not covered by an earlier task, add a new commit now with a clear message describing the fix.
