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
