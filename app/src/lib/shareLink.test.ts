import { beforeEach, describe, expect, it } from 'vitest'
import { buildGameShareUrl, buildMomentShareUrl, consumePendingShareTarget, parseShareParams, stashShareTargetFromUrl } from './shareLink'

describe('buildGameShareUrl / parseShareParams round trip', () => {
  it('round-trips a game-only link', () => {
    const url = buildGameShareUrl('game-1')
    expect(parseShareParams(new URL(url).search)).toEqual({ gameId: 'game-1', clipId: null, timeSeconds: null })
  })
})

describe('buildMomentShareUrl / parseShareParams round trip', () => {
  it('round-trips a moment link, flooring the seconds', () => {
    const url = buildMomentShareUrl('game-1', 'clip-1', 42.9)
    expect(parseShareParams(new URL(url).search)).toEqual({ gameId: 'game-1', clipId: 'clip-1', timeSeconds: 42 })
  })
})

describe('parseShareParams', () => {
  it('returns null when there is no game param', () => {
    expect(parseShareParams('?clip=clip-1&t=10')).toBeNull()
  })

  it('returns null timeSeconds for a non-numeric t', () => {
    expect(parseShareParams('?game=game-1&t=notanumber')).toEqual({ gameId: 'game-1', clipId: null, timeSeconds: null })
  })

  it('returns null for an empty search string', () => {
    expect(parseShareParams('')).toBeNull()
  })
})

describe('stashShareTargetFromUrl / consumePendingShareTarget', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stashes and then consumes a target found in the URL', () => {
    window.history.replaceState(null, '', '/?game=game-1&clip=clip-1&t=15')
    stashShareTargetFromUrl()
    expect(consumePendingShareTarget()).toEqual({ gameId: 'game-1', clipId: 'clip-1', timeSeconds: 15 })
  })

  it('consuming clears it — a second read returns null', () => {
    window.history.replaceState(null, '', '/?game=game-1')
    stashShareTargetFromUrl()
    consumePendingShareTarget()
    expect(consumePendingShareTarget()).toBeNull()
  })

  it('does not stash anything when the URL has no game param', () => {
    window.history.replaceState(null, '', '/')
    stashShareTargetFromUrl()
    expect(consumePendingShareTarget()).toBeNull()
  })
})
