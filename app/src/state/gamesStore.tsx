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
        if (data) setGames(data.map(rowToGame).sort(byDateDesc))
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
