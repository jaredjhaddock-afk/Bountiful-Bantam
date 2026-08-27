import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { bookmarkToInsertRow, rowToBookmark, type Bookmark } from './bookmarksStore.mappers'

export type { Bookmark } from './bookmarksStore.mappers'

/** Bookmarks for the one clip currently open for review. Not a global context — unlike
 *  playbook data (used across many simultaneous views), bookmarks only ever matter for
 *  whichever single clip is on screen, so there's no reason to load every clip's
 *  bookmarks up front. Mount this once per clip (VideoReviewPage owns it and threads
 *  the result down as props) — mounting it twice for the same clip produces two
 *  independent, unsynchronized fetches and local states, not a shared one. */
export function useClipBookmarks(clipId: string | null) {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)
  // Tracks each bookmark's in-flight insert so updateBookmarkNote (fired the moment the
  // user commits the note they typed right after creating) can wait for it instead of
  // racing it — an UPDATE that reaches Supabase before the INSERT lands is a silent no-op,
  // which would otherwise let the just-typed note get silently overwritten by the insert's
  // stale note: '' once it finally completes.
  const pendingInsertsRef = useRef<Map<string, PromiseLike<void>>>(new Map())

  useEffect(() => {
    if (!clipId) {
      setBookmarks([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('bookmarks')
      .select('*')
      .eq('clip_id', clipId)
      .order('time_seconds')
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (cancelled) return
        if (error) console.error('Failed to fetch bookmarks', error)
        if (data) setBookmarks((data as unknown[]).map((row) => rowToBookmark(row as Parameters<typeof rowToBookmark>[0])))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clipId])

  const createBookmark = useCallback(
    (timeSeconds: number) => {
      if (!clipId) throw new Error('No clip open')
      const bookmark: Bookmark = { id: crypto.randomUUID(), clipId, timeSeconds, note: '' }
      setBookmarks((prev) => [...prev, bookmark].sort((a, b) => a.timeSeconds - b.timeSeconds))
      if (teamId) {
        const insertPromise = supabase
          .from('bookmarks')
          .insert(bookmarkToInsertRow(bookmark, teamId, profile?.id ?? null))
          .then(({ error }: { error: unknown }) => {
            if (error) console.error('Failed to persist new bookmark', error)
          })
        pendingInsertsRef.current.set(bookmark.id, insertPromise)
      }
      return bookmark
    },
    [clipId, teamId, profile?.id],
  )

  const updateBookmarkNote = useCallback((id: string, note: string) => {
    setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, note } : b)))
    const write = () =>
      supabase
        .from('bookmarks')
        .update({ note })
        .eq('id', id)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error('Failed to persist bookmark note', error)
        })
    const pending = pendingInsertsRef.current.get(id)
    if (pending) {
      pendingInsertsRef.current.delete(id)
      pending.then(write)
    } else {
      write()
    }
  }, [])

  // Async and throwing (unlike create/update above) — this is the one bookmark write
  // wrapped in a confirm-then-retry UI (matching deleteFormation/deletePlay), which needs
  // a real rejection to catch and show a retryable error, not a silent console.error.
  const deleteBookmark = useCallback(async (id: string) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id)
    if (error) throw error
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  return { bookmarks, loading, createBookmark, updateBookmarkNote, deleteBookmark }
}

/** Bookmark counts per clip, for the clip-library badges. One team-scoped query (RLS
 *  handles the team filter, same as clipsStore's fetch), counted client-side — no new
 *  SQL function needed for what's a handful of rows per team. Only fetches once per
 *  mount (deps on `[teamId]` alone) — it relies on being remounted to see new counts,
 *  which happens today because ClipLibrary only mounts while `mode === 'library'` in
 *  VideoReviewPage. If that ever changes (e.g. keeping the library mounted to preserve
 *  scroll position), this hook will need an explicit refresh trigger. */
export function useBookmarkCountsByClip(): Record<string, number> {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    supabase
      .from('bookmarks')
      .select('clip_id')
      .then(({ data }: { data: { clip_id: string }[] | null }) => {
        if (cancelled || !data) return
        const next: Record<string, number> = {}
        for (const row of data) next[row.clip_id] = (next[row.clip_id] ?? 0) + 1
        setCounts(next)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return counts
}
