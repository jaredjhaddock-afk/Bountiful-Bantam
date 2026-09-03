import type { FramingKeyframe } from '../types/video'

export interface FramingRect {
  x: number
  y: number
  width: number
  height: number
}

export const FULL_FRAME: FramingRect = { x: 0, y: 0, width: 1, height: 1 }

function toRect(k: FramingKeyframe): FramingRect {
  return { x: k.x, y: k.y, width: k.width, height: k.height }
}

/** Interpolates the framing rect at `timeSeconds` from a clip's keyframes.
 *
 *  - No keyframes, or `timeSeconds` before the first one: the full, unzoomed frame.
 *  - Between two keyframes: linear interpolation of x/y/width/height.
 *  - At or after the last keyframe: that keyframe's exact rect, held — not the full
 *    frame. A single keyframe therefore zooms in at its timestamp and stays zoomed for
 *    the rest of the clip, which is what makes one keyframe alone a useful, complete
 *    action ("zoom in here and stay") rather than a rect that's visible for a single
 *    instant and then immediately reverts. */
export function interpolateFraming(keyframes: FramingKeyframe[], timeSeconds: number): FramingRect {
  if (keyframes.length === 0) return FULL_FRAME
  const sorted = [...keyframes].sort((a, b) => a.timeSeconds - b.timeSeconds)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (timeSeconds < first.timeSeconds) return FULL_FRAME
  if (timeSeconds >= last.timeSeconds) return toRect(last)

  let prev = first
  let curr = first
  for (const k of sorted) {
    if (k.timeSeconds <= timeSeconds) prev = k
    if (k.timeSeconds >= timeSeconds) {
      curr = k
      break
    }
  }
  if (prev.id === curr.id) return toRect(prev)
  const span = curr.timeSeconds - prev.timeSeconds
  const t = span > 0 ? (timeSeconds - prev.timeSeconds) / span : 0
  return {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t,
    width: prev.width + (curr.width - prev.width) * t,
    height: prev.height + (curr.height - prev.height) * t,
  }
}

/** Converts a framing rect into the CSS transform that zooms an element (with
 *  `transform-origin: 0 0`) to show exactly that rect filling its container.
 *
 *  `1 / rect.width` is the scale factor for both axes, not just the horizontal one,
 *  because every keyframe's rectangle is locked to the same 16:9 ratio as the video's
 *  own rendered box when it's drawn — so width and height always scale by the same
 *  amount. */
export function framingToTransform(rect: FramingRect): string {
  const scale = rect.width > 0 ? 1 / rect.width : 1
  return `scale(${scale}) translate(${-rect.x * 100}%, ${-rect.y * 100}%)`
}
