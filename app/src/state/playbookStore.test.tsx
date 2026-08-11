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
  { id: 'i-right', unit: 'offense', name: 'I Right', players: OFFENSE_PLAYERS },
  { id: 'split-right', unit: 'offense', name: 'Split Right', players: OFFENSE_PLAYERS },
  { id: 'deuce', unit: 'offense', name: 'Deuce', players: OFFENSE_PLAYERS },
  { id: 'duo', unit: 'offense', name: 'Duo', players: OFFENSE_PLAYERS },
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
    then: (onfulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onfulfilled),
  } as never
  return builder
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'formations') return makeBuilder({ data: FORMATION_ROWS, error: null })
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

  it('createPlay seeds players from the chosen formation with empty routes', async () => {
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
})
