export interface Game {
  id: string
  date: string
  opponent: string | null
  name: string | null
}

export interface GameRow {
  id: string
  date: string
  opponent: string | null
  name: string | null
}

export function rowToGame(row: GameRow): Game {
  return { id: row.id, date: row.date, opponent: row.opponent, name: row.name }
}

export function gameToInsertRow(game: Game, teamId: string) {
  return {
    id: game.id,
    team_id: teamId,
    date: game.date,
    opponent: game.opponent,
    name: game.name,
  }
}
