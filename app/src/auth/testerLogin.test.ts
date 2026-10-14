import { describe, expect, it } from 'vitest'
import { normalizeAccessCode } from './testerLogin'

describe('normalizeAccessCode', () => {
  it('ignores letter case so "BantamB" and "bantamb" both work', () => {
    expect(normalizeAccessCode('BantamB')).toBe('bantamb')
  })

  it('ignores surrounding whitespace from pasting or autocomplete', () => {
    expect(normalizeAccessCode('  bantamb \n')).toBe('bantamb')
  })
})
