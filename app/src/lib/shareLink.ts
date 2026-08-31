export interface ShareTarget {
  gameId: string
  clipId: string | null
  timeSeconds: number | null
}

const STORAGE_KEY = 'pendingShareTarget'

export function buildGameShareUrl(gameId: string): string {
  const url = new URL(window.location.href)
  url.search = `?game=${encodeURIComponent(gameId)}`
  return url.toString()
}

export function buildMomentShareUrl(gameId: string, clipId: string, timeSeconds: number): string {
  const url = new URL(window.location.href)
  url.search = `?game=${encodeURIComponent(gameId)}&clip=${encodeURIComponent(clipId)}&t=${Math.floor(timeSeconds)}`
  return url.toString()
}

export function parseShareParams(search: string): ShareTarget | null {
  const params = new URLSearchParams(search)
  const gameId = params.get('game')
  if (!gameId) return null
  const clipId = params.get('clip')
  const tRaw = params.get('t')
  const timeSeconds = tRaw !== null && !Number.isNaN(Number(tRaw)) ? Number(tRaw) : null
  return { gameId, clipId, timeSeconds }
}

/** Called once at app bootstrap (see main.tsx), before anything renders — stashes the
 *  share target from the current URL's query params, if any, so it survives a
 *  magic-link auth redirect that may not preserve the original query string. */
export function stashShareTargetFromUrl(): void {
  const target = parseShareParams(window.location.search)
  if (target) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target))
}

/** Reads and clears the share target stashed above. Call exactly once, from a
 *  ref-guarded effect — reading clears the underlying storage, so a second call
 *  always returns null even if the original link is still in the address bar. */
export function consumePendingShareTarget(): ShareTarget | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORAGE_KEY)
  try {
    return JSON.parse(raw) as ShareTarget
  } catch {
    return null
  }
}
