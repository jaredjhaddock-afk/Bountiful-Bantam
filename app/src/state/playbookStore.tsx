import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import type { Category, Formation, Play, Unit } from '../types/play'
import { playToInsertRow, playToUpdateRow, rowToCategory, rowToFormation, rowToPlay } from './playbookStore.mappers'
import { nextPlayNumber } from '../lib/listOrdering'

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
  updateFormation: (formation: Formation) => Promise<void>
  deleteFormation: (id: string) => Promise<{ blocked: true; playNames: string[] } | { blocked: false }>
  deletePlay: (id: string) => Promise<void>
  reorderFormations: (unit: Unit, orderedIds: string[]) => Promise<void>
  reorderPlays: (unit: Unit, orderedIds: string[]) => Promise<void>
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
      supabase.from('formations').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('plays').select('*').order('sort_order'),
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
    [formations, plays, teamId],
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
      const unitFormations = formations.filter((f) => f.unit === unit)
      const sortOrder = unitFormations.length === 0 ? 0 : Math.max(...unitFormations.map((f) => f.sortOrder)) + 1
      const { data, error } = await supabase.from('formations').insert({ team_id: teamId, unit, name, players, sort_order: sortOrder }).select().single()
      if (error || !data) throw error ?? new Error('Failed to create formation')
      const formation = rowToFormation(data)
      setFormations((prev) => [...prev, formation])
      return formation
    },
    [teamId, formations],
  )

  const updateFormation: PlaybookContextValue['updateFormation'] = useCallback(async (formation: Formation) => {
    const { data, error } = await supabase
      .from('formations')
      .update({ name: formation.name, players: formation.players })
      .eq('id', formation.id)
      .select()
      .single()
    if (error || !data) throw error ?? new Error('Formation not found or update was not permitted')
    setFormations((prev) => prev.map((f) => (f.id === formation.id ? formation : f)))
  }, [])

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
    const results = await Promise.all(orderedIds.map((id, idx) => supabase.from('formations').update({ sort_order: idx }).eq('id', id)))
    results.forEach(({ error }) => {
      if (error) console.error('Failed to persist formation reorder', error)
    })
  }, [])

  const reorderPlays: PlaybookContextValue['reorderPlays'] = useCallback(async (unit: Unit, orderedIds: string[]) => {
    setPlays((prev) =>
      prev.map((p) => {
        if (p.unit !== unit) return p
        const idx = orderedIds.indexOf(p.id)
        return idx === -1 ? p : { ...p, sortOrder: idx }
      }),
    )
    const results = await Promise.all(orderedIds.map((id, idx) => supabase.from('plays').update({ sort_order: idx }).eq('id', id)))
    results.forEach(({ error }) => {
      if (error) console.error('Failed to persist play reorder', error)
    })
  }, [])

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
      updateFormation,
      deleteFormation,
      deletePlay,
      reorderFormations,
      reorderPlays,
      createCategory,
      getFormation,
    }),
    [
      authTeamName,
      loading,
      formations,
      categories,
      plays,
      formationsForUnit,
      categoriesForUnit,
      createPlay,
      updatePlay,
      createFormation,
      updateFormation,
      deleteFormation,
      deletePlay,
      reorderFormations,
      reorderPlays,
      createCategory,
      getFormation,
    ],
  )

  return <PlaybookContext.Provider value={value}>{children}</PlaybookContext.Provider>
}

export function usePlaybook() {
  const ctx = useContext(PlaybookContext)
  if (!ctx) throw new Error('usePlaybook must be used within PlaybookProvider')
  return ctx
}
