import { describe, expect, it } from 'vitest'
import { TESTER_EMAIL_DOMAIN, testerEmail } from './testerLogin'

describe('testerEmail', () => {
  it('maps a username to the shared tester email address', () => {
    expect(testerEmail('Bantamb')).toBe(`bantamb@${TESTER_EMAIL_DOMAIN}`)
  })

  it('ignores surrounding whitespace and letter case so testers cannot mistype it', () => {
    expect(testerEmail('  BANTAMB ')).toBe(testerEmail('bantamb'))
  })
})
