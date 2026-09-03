import { describe, expect, it } from 'vitest'
import { FULL_FRAME, framingToTransform, interpolateFraming } from './framingTransform'

const kf = (timeSeconds: number, x: number, y: number, width: number, height: number, id = `${timeSeconds}`) => ({
  id,
  timeSeconds,
  x,
  y,
  width,
  height,
})

describe('interpolateFraming', () => {
  it('returns the full frame when there are no keyframes', () => {
    expect(interpolateFraming([], 5)).toEqual(FULL_FRAME)
  })

  it('returns the full frame before the first keyframe', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 5)).toEqual(FULL_FRAME)
  })

  it('returns the exact keyframe rect at its own timestamp', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 10)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
  })

  it('holds the last keyframe rect at and after its timestamp (a single keyframe stays applied for the rest of the clip)', () => {
    const keyframes = [kf(10, 0.25, 0.25, 0.5, 0.5)]
    expect(interpolateFraming(keyframes, 999)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
  })

  it('linearly interpolates the midpoint between two keyframes', () => {
    const keyframes = [kf(0, 0, 0, 1, 1), kf(10, 0.4, 0.2, 0.2, 0.2)]
    expect(interpolateFraming(keyframes, 5)).toEqual({ x: 0.2, y: 0.1, width: 0.6, height: 0.6 })
  })

  it('holds the last keyframe rect after the last of three keyframes', () => {
    const keyframes = [kf(0, 0, 0, 1, 1), kf(5, 0.5, 0.5, 0.25, 0.25), kf(10, 0.1, 0.1, 0.3, 0.3)]
    expect(interpolateFraming(keyframes, 20)).toEqual({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 })
  })

  it('sorts out-of-order keyframes by time before interpolating', () => {
    const keyframes = [kf(10, 0.4, 0.2, 0.2, 0.2), kf(0, 0, 0, 1, 1)]
    expect(interpolateFraming(keyframes, 5)).toEqual({ x: 0.2, y: 0.1, width: 0.6, height: 0.6 })
  })
})

describe('framingToTransform', () => {
  it('is the identity transform for the full frame', () => {
    expect(framingToTransform(FULL_FRAME)).toBe('scale(1) translate(0%, 0%)')
  })

  it('scales and translates to zoom into a rect', () => {
    expect(framingToTransform({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).toBe('scale(2) translate(-25%, -25%)')
  })
})
