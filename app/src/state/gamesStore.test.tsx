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
