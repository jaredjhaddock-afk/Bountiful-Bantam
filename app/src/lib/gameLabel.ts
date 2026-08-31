export interface LabelableGame {
  date: string // ISO yyyy-mm-dd
  opponent: string | null
  name: string | null
}

export function formatGameDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}/${d}`
}

// A custom name, when set, is always the override — it's the coach's own label,
// chosen specifically to replace the auto-generated "date vs opponent" one (e.g. a
// practice with no opponent, or a game the coach wants labeled "Homecoming" instead).
export function gameLabel(game: LabelableGame): string {
  if (game.name) return game.name
  if (game.opponent) return `${formatGameDate(game.date)} vs ${game.opponent}`
  return formatGameDate(game.date)
}
