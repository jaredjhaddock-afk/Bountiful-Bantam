import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Category, Formation, PlayerRole, Play, Unit } from '../types/play'

function spreadRow(
  count: number,
  y: number,
  labels: string[],
  role: PlayerRole,
  xStart = 10,
  xEnd = 90,
): Formation['players'] {
  const step = count > 1 ? (xEnd - xStart) / (count - 1) : 0
  return Array.from({ length: count }, (_, i) => ({
    id: `${labels[i] ?? `P${i}`}-${y}`,
    label: labels[i] ?? `${i + 1}`,
    role,
    x: xStart + step * i,
    y,
  }))
}

const OFFENSE_FORMATIONS: Formation[] = [
  {
    id: 'i-right',
    name: 'I Right',
    unit: 'offense',
    players: [
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
    ],
  },
  {
    id: 'split-right',
    name: 'Split Right',
    unit: 'offense',
    players: [
      { id: 'X', label: 'X', role: 'skill', x: 12, y: 30 },
      { id: 'LT', label: 'LT', role: 'lineman', x: 38, y: 30 },
      { id: 'LG', label: 'LG', role: 'lineman', x: 42, y: 30 },
      { id: 'C', label: 'C', role: 'lineman', x: 46, y: 30 },
      { id: 'RG', label: 'RG', role: 'lineman', x: 50, y: 30 },
      { id: 'RT', label: 'RT', role: 'lineman', x: 54, y: 30 },
      { id: 'Y', label: 'Y', role: 'skill', x: 58, y: 30 },
      { id: 'O', label: 'O', role: 'qb', x: 46, y: 34 },
      { id: 'F', label: 'F', role: 'skill', x: 40, y: 36 },
      { id: 'H', label: 'H', role: 'skill', x: 52, y: 36 },
      { id: 'Z', label: 'Z', role: 'skill', x: 68, y: 30 },
    ],
  },
  {
    id: 'deuce',
    name: 'Deuce',
    unit: 'offense',
    players: [
      { id: 'X', label: 'X', role: 'skill', x: 12, y: 30 },
      { id: 'LT', label: 'LT', role: 'lineman', x: 38, y: 30 },
      { id: 'LG', label: 'LG', role: 'lineman', x: 42, y: 30 },
      { id: 'C', label: 'C', role: 'lineman', x: 46, y: 30 },
      { id: 'RG', label: 'RG', role: 'lineman', x: 50, y: 30 },
      { id: 'RT', label: 'RT', role: 'lineman', x: 54, y: 30 },
      { id: 'Y', label: 'Y', role: 'skill', x: 58, y: 30 },
      { id: 'O', label: 'O', role: 'qb', x: 46, y: 34 },
      { id: 'F', label: 'F', role: 'skill', x: 42, y: 37 },
      { id: 'H', label: 'H', role: 'skill', x: 42, y: 41 },
      { id: 'Z', label: 'Z', role: 'skill', x: 68, y: 30 },
    ],
  },
  {
    id: 'duo',
    name: 'Duo',
    unit: 'offense',
    players: [
      { id: 'X', label: 'X', role: 'skill', x: 8, y: 30 },
      { id: 'LT', label: 'LT', role: 'lineman', x: 38, y: 30 },
      { id: 'LG', label: 'LG', role: 'lineman', x: 42, y: 30 },
      { id: 'C', label: 'C', role: 'lineman', x: 46, y: 30 },
      { id: 'RG', label: 'RG', role: 'lineman', x: 50, y: 30 },
      { id: 'RT', label: 'RT', role: 'lineman', x: 54, y: 30 },
      { id: 'Y', label: 'Y', role: 'skill', x: 58, y: 30 },
      { id: 'O', label: 'O', role: 'qb', x: 46, y: 34 },
      { id: 'F', label: 'F', role: 'skill', x: 20, y: 36 },
      { id: 'H', label: 'H', role: 'skill', x: 46, y: 39 },
      { id: 'Z', label: 'Z', role: 'skill', x: 72, y: 30 },
    ],
  },
]

const DEFENSE_FORMATIONS: Formation[] = [
  {
    id: '4-3',
    name: '4-3',
    unit: 'defense',
    players: [
      { id: 'LE', label: 'LE', role: 'defense', x: 40, y: 26 },
      { id: 'DT1', label: 'DT', role: 'defense', x: 44, y: 26 },
      { id: 'DT2', label: 'DT', role: 'defense', x: 48, y: 26 },
      { id: 'RE', label: 'RE', role: 'defense', x: 52, y: 26 },
      { id: 'WL', label: 'W', role: 'defense', x: 36, y: 22 },
      { id: 'ML', label: 'M', role: 'defense', x: 46, y: 20 },
      { id: 'SL', label: 'S', role: 'defense', x: 56, y: 22 },
      { id: 'CB1', label: 'C', role: 'defense', x: 12, y: 25 },
      { id: 'CB2', label: 'C', role: 'defense', x: 80, y: 25 },
      { id: 'FS', label: 'F', role: 'defense', x: 46, y: 10 },
      { id: 'SS', label: 'S', role: 'defense', x: 60, y: 14 },
    ],
  },
  {
    id: '3-4',
    name: '3-4',
    unit: 'defense',
    players: [
      ...spreadRow(3, 26, ['DE', 'NT', 'DE'], 'defense', 40, 56),
      ...spreadRow(4, 21, ['OLB', 'ILB', 'ILB', 'OLB'], 'defense', 30, 66),
      ...spreadRow(2, 25, ['C', 'C'], 'defense', 12, 84),
      ...spreadRow(2, 11, ['F', 'S'], 'defense', 40, 58),
    ],
  },
  {
    id: 'nickel',
    name: 'Nickel',
    unit: 'defense',
    players: [
      ...spreadRow(4, 26, ['LE', 'DT', 'DT', 'RE'], 'defense', 38, 58),
      ...spreadRow(2, 21, ['W', 'M'], 'defense', 38, 58),
      ...spreadRow(3, 24, ['C', 'N', 'C'], 'defense', 12, 84),
      ...spreadRow(2, 11, ['F', 'S'], 'defense', 40, 58),
    ],
  },
]

const SPECIAL_TEAMS_FORMATIONS: Formation[] = [
  {
    id: 'kickoff',
    name: 'Kickoff',
    unit: 'specialTeams',
    players: [...spreadRow(10, 20, [], 'specialTeams', 8, 88), { id: 'K', label: 'K', role: 'specialTeams', x: 46, y: 30 }],
  },
  {
    id: 'kick-return',
    name: 'Kick Return',
    unit: 'specialTeams',
    players: [...spreadRow(9, 25, [], 'specialTeams', 10, 86), { id: 'R1', label: 'R', role: 'specialTeams', x: 46, y: 45 }, { id: 'R2', label: 'R', role: 'specialTeams', x: 40, y: 50 }],
  },
  {
    id: 'punt',
    name: 'Punt',
    unit: 'specialTeams',
    players: [...spreadRow(10, 26, [], 'specialTeams', 12, 84), { id: 'P', label: 'P', role: 'specialTeams', x: 46, y: 38 }],
  },
  {
    id: 'punt-return-block',
    name: 'Punt Return/Block',
    unit: 'specialTeams',
    players: [...spreadRow(10, 25, [], 'specialTeams', 12, 84), { id: 'PR', label: 'R', role: 'specialTeams', x: 46, y: 45 }],
  },
  {
    id: 'fg-pat',
    name: 'Field Goal/PAT',
    unit: 'specialTeams',
    players: [
      ...spreadRow(7, 26, [], 'specialTeams', 30, 62),
      { id: 'H', label: 'H', role: 'specialTeams', x: 46, y: 33 },
      { id: 'K', label: 'K', role: 'specialTeams', x: 46, y: 38 },
      { id: 'LS', label: 'LS', role: 'specialTeams', x: 46, y: 28 },
      { id: 'W1', label: 'W', role: 'specialTeams', x: 24, y: 26 },
      { id: 'W2', label: 'W', role: 'specialTeams', x: 68, y: 26 },
    ],
  },
  {
    id: 'fg-pat-block',
    name: 'Field Goal/PAT Block',
    unit: 'specialTeams',
    players: spreadRow(11, 25, [], 'specialTeams', 26, 66),
  },
]

const FORMATIONS: Formation[] = [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS, ...SPECIAL_TEAMS_FORMATIONS]

const CATEGORIES: Category[] = [
  { id: 'run', name: 'Run', unit: 'offense' },
  { id: 'pass', name: 'Pass', unit: 'offense' },
  { id: 'uncategorized-offense', name: 'Uncategorized', unit: 'offense' },
  { id: 'uncategorized-defense', name: 'Uncategorized', unit: 'defense' },
  { id: 'uncategorized-specialTeams', name: 'Uncategorized', unit: 'specialTeams' },
]

interface PlaybookContextValue {
  teamName: string
  formations: Formation[]
  categories: Category[]
  plays: Play[]
  formationsForUnit: (unit: Unit) => Formation[]
  createPlay: (input: { name: string; unit: Unit; formationId: string; categoryId: string; positionNotes: Record<string, string> }) => Play
  updatePlay: (play: Play) => void
  getFormation: (id: string) => Formation | undefined
}

const PlaybookContext = createContext<PlaybookContextValue | null>(null)

export function PlaybookProvider({ children }: { children: ReactNode }) {
  const [plays, setPlays] = useState<Play[]>([])

  const formationsForUnit = useCallback((unit: Unit) => FORMATIONS.filter((f) => f.unit === unit), [])

  const getFormation = useCallback((id: string) => FORMATIONS.find((f) => f.id === id), [])

  const createPlay: PlaybookContextValue['createPlay'] = useCallback(
    ({ name, unit, formationId, categoryId, positionNotes }) => {
      const formation = FORMATIONS.find((f) => f.id === formationId)
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
      return play
    },
    [],
  )

  const updatePlay = useCallback((play: Play) => {
    setPlays((prev) => prev.map((p) => (p.id === play.id ? play : p)))
  }, [])

  const value = useMemo<PlaybookContextValue>(
    () => ({
      teamName: 'Bantam B',
      formations: FORMATIONS,
      categories: CATEGORIES,
      plays,
      formationsForUnit,
      createPlay,
      updatePlay,
      getFormation,
    }),
    [plays, formationsForUnit, createPlay, updatePlay, getFormation],
  )

  return <PlaybookContext.Provider value={value}>{children}</PlaybookContext.Provider>
}

export function usePlaybook() {
  const ctx = useContext(PlaybookContext)
  if (!ctx) throw new Error('usePlaybook must be used within PlaybookProvider')
  return ctx
}
