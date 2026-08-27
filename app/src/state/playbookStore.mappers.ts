import type { Category, Formation, Play } from '../types/play'

export interface FormationRow {
  id: string
  unit: string
  name: string
  players: Formation['players']
  sort_order: number
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
  sort_order: number
  number: number
}

export function rowToFormation(row: FormationRow): Formation {
  return { id: row.id, name: row.name, unit: row.unit as Formation['unit'], players: row.players ?? [], sortOrder: row.sort_order }
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
    sortOrder: row.sort_order,
    number: row.number,
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
    sort_order: play.sortOrder,
    number: play.number,
  }
}

export function playToUpdateRow(play: Play) {
  return {
    name: play.name,
    players: play.players,
    annotations: play.annotations,
    position_notes: play.positionNotes,
    category_id: play.categoryId,
    sort_order: play.sortOrder,
    number: play.number,
    updated_at: new Date().toISOString(),
  }
}
