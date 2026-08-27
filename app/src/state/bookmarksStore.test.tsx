import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useClipBookmarks, useBookmarkCountsByClip } from './bookmarksStore'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' } }),
}))

const BOOKMARK_ROWS = [
  { id: 'bm-1', clip_id: 'clip-1', time_seconds: 30, note: 'X ran wrong route' },
  { id: 'bm-2', clip_id: 'clip-1', time_seconds: 10, note: '' },
  { id: 'bm-3', clip_id: 'clip-2', time_seconds: 5, note: 'Defense blitzed' },
]

function makeBookmarksBuilder() {
  let eqClipId: string | null = null
  let eqId: string | null = null
  let updatePayload: Record<string, unknown> | null = null
  let deleted = false
  let insertedRow: Record<string, unknown> | null = null

  const builder = {
    select: (cols?: string) => {
      if (cols === 'clip_id') return Promise.resolve({ data: BOOKMARK_ROWS.map((r) => ({ clip_id: r.clip_id })), error: null })
      return builder
    },
    eq: (col: string, val: unknown) => {
      if (col === 'clip_id') eqClipId = String(val)
      else eqId = String(val)
      return builder
    },
    order: () =>
      Promise.resolve({
        data: BOOKMARK_ROWS.filter((r) => r.clip_id === eqClipId).sort((a, b) => a.time_seconds - b.time_seconds),
        error: null,
      }),
    insert: (row: Record<string, unknown>) => {
      insertedRow = row
      return Promise.resolve({ data: null, error: null })
    },
    update: (payload: Record<string, unknown>) => {
      updatePayload = payload
      return builder
    },
    delete: () => {
      deleted = true
      return builder
    },
    then: (onfulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
      const result = deleted
        ? { data: null, error: null }
        : updatePayload
          ? { data: { id: eqId, ...updatePayload }, error: null }
          : { data: insertedRow, error: null }
      return Promise.resolve(result).then(onfulfilled)
    },
  }
  return builder
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bookmarks') return makeBookmarksBuilder()
      return { select: () => Promise.resolve({ data: [], error: null }) }
    },
  },
}))

describe('useClipBookmarks', () => {
  it('fetches bookmarks scoped to the given clip, ordered by time', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(['bm-2', 'bm-1'])
  })

  it('returns an empty list and does not fetch when clipId is null', async () => {
    const { result } = renderHook(() => useClipBookmarks(null))
    expect(result.current.bookmarks).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('createBookmark adds a bookmark to local state immediately, sorted by time', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created: ReturnType<typeof result.current.createBookmark>
    act(() => {
      created = result.current.createBookmark(20)
    })
    expect(created!.timeSeconds).toBe(20)
    expect(created!.note).toBe('')
    expect(result.current.bookmarks.map((b) => b.timeSeconds)).toEqual([10, 20, 30])
  })

  it('updateBookmarkNote updates the note in local state', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.updateBookmarkNote('bm-2', 'Good rep')
    })
    expect(result.current.bookmarks.find((b) => b.id === 'bm-2')!.note).toBe('Good rep')
  })

  it('queues updateBookmarkNote behind a still-pending createBookmark insert, so the note is not lost to the race', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created: ReturnType<typeof result.current.createBookmark>
    act(() => {
      created = result.current.createBookmark(20)
      result.current.updateBookmarkNote(created!.id, 'Good rep')
    })
    expect(result.current.bookmarks.find((b) => b.id === created!.id)!.note).toBe('Good rep')
  })

  it('deleteBookmark removes the bookmark from local state', async () => {
    const { result } = renderHook(() => useClipBookmarks('clip-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteBookmark('bm-1')
    })
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(['bm-2'])
  })
})

describe('useBookmarkCountsByClip', () => {
  it('counts bookmarks per clip_id', async () => {
    const { result } = renderHook(() => useBookmarkCountsByClip())
    await waitFor(() => expect(result.current).toEqual({ 'clip-1': 2, 'clip-2': 1 }))
  })
})
