export function formatTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface TimedBookmark {
  id: string
  timeSeconds: number
}

// A tiny epsilon absorbs floating-point/seek imprecision (e.g. right after jumping to a
// bookmark, currentTime may read a few ms off from its exact timestamp) without being wide
// enough to skip over a bookmark the video is genuinely still approaching.
const EPSILON_SECONDS = 0.01

export function findAdjacentBookmark<T extends TimedBookmark>(
  bookmarks: T[],
  currentTime: number,
  direction: 1 | -1,
): T | null {
  const sorted = [...bookmarks].sort((a, b) => a.timeSeconds - b.timeSeconds)
  if (direction === 1) {
    return sorted.find((b) => b.timeSeconds > currentTime + EPSILON_SECONDS) ?? null
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].timeSeconds < currentTime - EPSILON_SECONDS) return sorted[i]
  }
  return null
}

export function fileFingerprint(fileName: string, sizeBytes: number): string {
  return `${fileName}:${sizeBytes}`
}
