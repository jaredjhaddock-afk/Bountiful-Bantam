import { describe, expect, it } from 'vitest'
import { fileFingerprint, findAdjacentBookmark, formatTimestamp } from './bookmarkUtils'

describe('formatTimestamp', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTimestamp(47)).toBe('0:47')
    expect(formatTimestamp(75)).toBe('1:15')
  })

  it('pads seconds under 10', () => {
    expect(formatTimestamp(65)).toBe('1:05')
  })

  it('does not wrap into an hours component past 59 minutes', () => {
    expect(formatTimestamp(3900)).toBe('65:00')
  })

  it('floors fractional seconds and clamps negative input to 0:00', () => {
    expect(formatTimestamp(47.9)).toBe('0:47')
    expect(formatTimestamp(-3)).toBe('0:00')
  })

  it('renders non-finite input (e.g. NaN before video metadata loads) as 0:00', () => {
    expect(formatTimestamp(NaN)).toBe('0:00')
    expect(formatTimestamp(Infinity)).toBe('0:00')
  })
})

describe('findAdjacentBookmark', () => {
  const bookmarks = [
    { id: 'a', timeSeconds: 10 },
    { id: 'b', timeSeconds: 30 },
    { id: 'c', timeSeconds: 60 },
  ]

  it('finds the next bookmark after the current time', () => {
    expect(findAdjacentBookmark(bookmarks, 15, 1)?.id).toBe('b')
  })

  it('finds the previous bookmark before the current time', () => {
    expect(findAdjacentBookmark(bookmarks, 45, -1)?.id).toBe('b')
  })

  it('returns null past the last bookmark going forward', () => {
    expect(findAdjacentBookmark(bookmarks, 60, 1)).toBeNull()
  })

  it('returns null before the first bookmark going backward', () => {
    expect(findAdjacentBookmark(bookmarks, 10, -1)).toBeNull()
  })

  it('does not treat sitting exactly on a bookmark as being past it in either direction', () => {
    expect(findAdjacentBookmark(bookmarks, 30, 1)?.id).toBe('c')
    expect(findAdjacentBookmark(bookmarks, 30, -1)?.id).toBe('a')
  })

  it('returns null when there are no bookmarks', () => {
    expect(findAdjacentBookmark([], 15, 1)).toBeNull()
  })

  it('works correctly regardless of input order', () => {
    const shuffled = [bookmarks[2], bookmarks[0], bookmarks[1]]
    expect(findAdjacentBookmark(shuffled, 15, 1)?.id).toBe('b')
  })
})

describe('fileFingerprint', () => {
  it('combines filename and size with a colon', () => {
    expect(fileFingerprint('cam1ghxcccos.mp4', 104857600)).toBe('cam1ghxcccos.mp4:104857600')
  })

  it('distinguishes same-named files with different sizes', () => {
    expect(fileFingerprint('file2.mp4', 977272934)).not.toBe(fileFingerprint('file2.mp4', 685836697))
  })
})
