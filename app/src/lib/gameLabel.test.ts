import { describe, expect, it } from 'vitest'
import { formatGameDate, gameLabel } from './gameLabel'

describe('formatGameDate', () => {
  it('formats an ISO date as m/d', () => {
    expect(formatGameDate('2026-08-29')).toBe('8/29')
  })

  it('does not zero-pad', () => {
    expect(formatGameDate('2026-01-05')).toBe('1/5')
  })
})

describe('gameLabel', () => {
  it('shows date vs opponent when only opponent is set', () => {
    expect(gameLabel({ date: '2026-08-29', opponent: 'Corner Canyon', name: null })).toBe('8/29 vs Corner Canyon')
  })

  it('shows just the custom name when only name is set', () => {
    expect(gameLabel({ date: '2026-08-25', opponent: null, name: 'Tuesday walkthrough' })).toBe('Tuesday walkthrough')
  })

  it('shows just the date when neither is set', () => {
    expect(gameLabel({ date: '2026-08-25', opponent: null, name: null })).toBe('8/25')
  })

  it('prefers the custom name over the opponent when both are set', () => {
    expect(gameLabel({ date: '2026-08-29', opponent: 'Corner Canyon', name: 'Homecoming' })).toBe('Homecoming')
  })
})
