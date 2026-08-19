import { describe, expect, it } from 'vitest'
import { isNumberTaken, nextPlayNumber, reorderIds } from './listOrdering'

describe('nextPlayNumber', () => {
  it('returns 1 when there are no existing numbers', () => {
    expect(nextPlayNumber([])).toBe(1)
  })

  it('returns one more than the highest existing number', () => {
    expect(nextPlayNumber([3, 1, 7, 2])).toBe(8)
  })
})

describe('isNumberTaken', () => {
  const plays = [
    { id: 'a', number: 10 },
    { id: 'b', number: 20 },
    { id: 'c', number: 30 },
  ]

  it('returns true when another play already has that number', () => {
    expect(isNumberTaken(plays, 20, 'a')).toBe(true)
  })

  it('returns false when the number is free', () => {
    expect(isNumberTaken(plays, 99, 'a')).toBe(false)
  })

  it('excludes the play being edited from the check (its own current number is not "taken")', () => {
    expect(isNumberTaken(plays, 10, 'a')).toBe(false)
  })
})

describe('reorderIds', () => {
  it('moves the dragged id to the target index, preserving the rest of the order', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an id from the middle to the front', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'c', 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an id from the middle to the end', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'b', 3)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('is a no-op (relative to the dragged id\'s own removal) when the target index equals its current position', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  })

  it('clamps an out-of-range index to the end of the list', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
  })
})
