export function timeToPercent(time: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(100, Math.max(0, (time / duration) * 100))
}

export function percentToTime(ratio: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(1, Math.max(0, ratio)) * duration
}
