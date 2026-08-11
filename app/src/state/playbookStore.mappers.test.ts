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
