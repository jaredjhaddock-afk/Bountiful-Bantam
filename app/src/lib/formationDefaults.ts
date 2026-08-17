import type { Formation, PlayerRole } from '../types/play'
import { ROLE_COLOR } from './roleColors'

/** The only skill-position labels offered in the formation editor's rename flow. */
export const SKILL_POSITION_LABELS = ['X', 'F', 'Y', 'Z', 'H'] as const

/** The 5 offensive line labels, always read left-to-right in this order — see mirrorFormation.ts. */
export const LINEMAN_LABELS = ['LT', 'LG', 'C', 'RG', 'RT'] as const

function token(id: string, label: string, role: PlayerRole, x: number, y: number): Formation['players'][number] {
  return { id, label, role, x, y, color: ROLE_COLOR[role], fillStyle: 'outline' }
}

/**
 * The 11 tokens a brand-new offensive formation starts with. Coordinates use the existing
 * 100(w) x 60(h) field viewBox with the line of scrimmage at y=30: X/LT/LG/C/RG/RT/Y sit on
 * the LOS, F/Z a few yards back off the line, Q centered in the backfield, H directly behind Q.
 * Returns a fresh array each call (not a shared constant) so multiple editor sessions never
 * accidentally share object references.
 */
export function createDefaultOffensePlayers(): Formation['players'] {
  return [
    token('x', 'X', 'skill', 22, 30),
    token('lt', 'LT', 'lineman', 42, 30),
    token('lg', 'LG', 'lineman', 46, 30),
    token('c', 'C', 'lineman', 50, 30),
    token('rg', 'RG', 'lineman', 54, 30),
    token('rt', 'RT', 'lineman', 58, 30),
    token('y', 'Y', 'skill', 78, 30),
    token('f', 'F', 'skill', 32, 36),
    token('q', 'Q', 'qb', 50, 38),
    token('h', 'H', 'skill', 50, 44),
    token('z', 'Z', 'skill', 82, 36),
  ]
}
