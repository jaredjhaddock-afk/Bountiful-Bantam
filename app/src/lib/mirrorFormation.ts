import type { Formation } from '../types/play'
import { LINEMAN_LABELS } from './formationDefaults'

/**
 * Flips every token's x-coordinate horizontally (x' = fieldWidth - x). Skill/QB tokens keep
 * their own label attached to the same token. The 5 lineman tokens are special-cased: after
 * flipping, they're relabeled by their resulting left-to-right sorted x-order (LT, LG, C, RG,
 * RT), so the line always reads correctly left to right regardless of which physical token
 * ends up where, or what it was labeled before.
 */
export function mirrorFormation(players: Formation['players'], fieldWidth: number): Formation['players'] {
  const flipped = players.map((p) => ({ ...p, x: fieldWidth - p.x }))

  const linemen = flipped.filter((p) => p.role === 'lineman').sort((a, b) => a.x - b.x)
  const relabeledLinemen = new Map(linemen.map((p, i) => [p.id, LINEMAN_LABELS[i]]))

  // Falls back to the token's pre-mirror label if there are more than 5 linemen (LINEMAN_LABELS
  // runs out) or a duplicate id collapses the map — degrades gracefully instead of silently
  // producing an undefined label, since a formation could reach this in a malformed state from
  // some other editing path.
  return flipped.map((p) => (p.role === 'lineman' ? { ...p, label: relabeledLinemen.get(p.id) ?? p.label } : p))
}
