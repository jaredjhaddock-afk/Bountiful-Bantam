import { describe, expect, it } from 'vitest'
import { timeToPercent, percentToTime } from './fieldMath'

describe('timeToPercent', () => {
  it('converts a time to a percentage of duration', () => {
    expect(timeToPercent(30, 120)).toBe(25)
  })

  it('clamps below 0', () => {
    expect(timeToPercent(-5, 120)).toBe(0)
  })

  it('clamps above duration', () => {
    expect(timeToPercent(200, 120)).toBe(100)
  })

  it('returns 0 when duration is 0', () => {
    expect(timeToPercent(5, 0)).toBe(0)
  })
})

describe('percentToTime', () => {
  it('converts a 0-1 ratio to a time', () => {
    expect(percentToTime(0.25, 120)).toBe(30)
  })

  it('clamps below 0', () => {
    expect(percentToTime(-0.5, 120)).toBe(0)
  })

  it('clamps above 1', () => {
    expect(percentToTime(1.5, 120)).toBe(120)
  })
})
