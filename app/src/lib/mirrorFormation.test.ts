import { describe, expect, it } from 'vitest'
import { mirrorFormation } from './mirrorFormation'
import type { Formation } from '../types/play'

describe('mirrorFormation', () => {
  it('flips x for every token and leaves y unchanged', () => {
    const players: Formation['players'] = [{ id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#00746b', fillStyle: 'outline' }]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored[0].x).toBe(80)
    expect(mirrored[0].y).toBe(30)
  })

  it('keeps a skill/QB token\'s own label attached through the flip', () => {
    const players: Formation['players'] = [
      { id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#00746b', fillStyle: 'outline' },
      { id: 'z', label: 'Z', role: 'skill', x: 80, y: 36, color: '#00746b', fillStyle: 'outline' },
      { id: 'q', label: 'Q', role: 'qb', x: 50, y: 38, color: '#900203', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored.find((p) => p.id === 'x')).toMatchObject({ label: 'X', x: 80 })
    expect(mirrored.find((p) => p.id === 'z')).toMatchObject({ label: 'Z', x: 20 })
    expect(mirrored.find((p) => p.id === 'q')).toMatchObject({ label: 'Q', x: 50 })
  })

  it('relabels the 5 linemen by their post-mirror left-to-right order, regardless of prior label or id', () => {
    const defaultOrder: Formation['players'] = [
      { id: 'lt', label: 'LT', role: 'lineman', x: 42, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'lg', label: 'LG', role: 'lineman', x: 46, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'c', label: 'C', role: 'lineman', x: 50, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rg', label: 'RG', role: 'lineman', x: 54, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rt', label: 'RT', role: 'lineman', x: 58, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(defaultOrder, 100)
    const sorted = [...mirrored].sort((a, b) => a.x - b.x)
    expect(sorted.map((p) => p.label)).toEqual(['LT', 'LG', 'C', 'RG', 'RT'])
  })

  it('relabels correctly even when a lineman was previously dragged out of order', () => {
    const shuffled: Formation['players'] = [
      { id: 'lt', label: 'LT', role: 'lineman', x: 46, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'lg', label: 'LG', role: 'lineman', x: 50, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'c', label: 'C', role: 'lineman', x: 54, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rg', label: 'RG', role: 'lineman', x: 58, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
      { id: 'rt', label: 'RT', role: 'lineman', x: 20, y: 30, color: '#4d4d4d', fillStyle: 'outline' },
    ]
    const mirrored = mirrorFormation(shuffled, 100)
    const sorted = [...mirrored].sort((a, b) => a.x - b.x)
    // Mirrored x's: lt->54, lg->50, c->46, rg->42, rt->80. Sorted ascending: rg(42), c(46), lg(50), lt(54), rt(80).
    expect(sorted.map((p) => p.id)).toEqual(['rg', 'c', 'lg', 'lt', 'rt'])
    expect(sorted.map((p) => p.label)).toEqual(['LT', 'LG', 'C', 'RG', 'RT'])
  })

  it('preserves color and fillStyle through the mirror', () => {
    const players: Formation['players'] = [{ id: 'x', label: 'X', role: 'skill', x: 20, y: 30, color: '#d0021b', fillStyle: 'solid' }]
    const mirrored = mirrorFormation(players, 100)
    expect(mirrored[0]).toMatchObject({ color: '#d0021b', fillStyle: 'solid' })
  })
})
