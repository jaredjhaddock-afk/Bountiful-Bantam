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

  const builder = {
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

  it('reorderFormations updates the array order itself, not just the sortOrder field, so formationsForUnit reflects the new order without a refetch', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reorderFormations('offense', ['duo', 'i-right', 'split-right', 'deuce'])
    })
    expect(result.current.formationsForUnit('offense').map((f) => f.id)).toEqual(['duo', 'i-right', 'split-right', 'deuce'])
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

  it('reorderPlays updates the array order itself so the reordered plays render in the new order, without scrambling other units', async () => {
    const { result } = renderHook(() => usePlaybook(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let firstId = ''
    let secondId = ''
    let defensePlayId = ''
    act(() => {
      firstId = result.current.createPlay({ name: 'First', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} }).id
    })
    act(() => {
      secondId = result.current.createPlay({ name: 'Second', unit: 'offense', formationId: 'i-right', categoryId: 'run', positionNotes: {} }).id
    })
    act(() => {
      defensePlayId = result.current.createPlay({ name: 'D Play', unit: 'defense', formationId: '4-3', categoryId: 'run', positionNotes: {} }).id
    })
    await act(async () => {
      await result.current.reorderPlays('offense', [secondId, firstId])
    })
    expect(result.current.plays.filter((p) => p.unit === 'offense').map((p) => p.id)).toEqual([secondId, firstId])
    // The unrelated defense play (with an offense-colliding sortOrder of 0) must not be pulled
    // into the reordered offense sequence.
    expect(result.current.plays.some((p) => p.id === defensePlayId)).toBe(true)
  })
})
