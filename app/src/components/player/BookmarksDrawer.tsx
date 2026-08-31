import { useEffect, useRef, useState } from 'react'
import type { Bookmark } from '../../state/bookmarksStore'
import { formatTimestamp } from '../../lib/bookmarkUtils'
import { buildMomentShareUrl } from '../../lib/shareLink'
import { CheckIcon, ShareIcon, TrashIcon } from '../icons'

interface BookmarksDrawerProps {
  bookmarks: Bookmark[]
  expanded: boolean
  onToggleExpanded: () => void
  /** The bookmark to open in edit mode, if any. Must be an id newly added to `bookmarks`
   *  this render (e.g. from onCreateBookmark) — setting it to an id that's already
   *  mounted is a no-op, since the row's initial-edit-state is only read once, at mount. */
  focusBookmarkId: string | null
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
  /** Needed to build a moment share link. Sharing a specific bookmark only makes sense
   *  once its clip belongs to a game — an "Unassigned" clip has no game to deep-link
   *  into, so `gameId` is null there and the per-row share button doesn't render. */
  gameId: string | null
  clipId: string
}

function BookmarkRow({
  bookmark,
  autoFocus,
  onFocusConsumed,
  onSeek,
  onUpdateNote,
  onDeleteRequest,
  onShare,
  justCopied,
}: {
  bookmark: Bookmark
  autoFocus: boolean
  onFocusConsumed: () => void
  onSeek: (timeSeconds: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteRequest: (bookmark: Bookmark) => void
  onShare: (() => void) | null
  justCopied: boolean
}) {
  const [editing, setEditing] = useState(autoFocus)
  const [draft, setDraft] = useState(bookmark.note)
  const committedRef = useRef(false)

  // Fires once per mount, not on every autoFocus/prop change (empty deps): tells the
  // parent to clear its "focus this row" request immediately after we've applied it, so
  // a later unrelated remount of this row (e.g. collapsing/expanding the drawer) doesn't
  // reopen the editor against the user's wishes.
  useEffect(() => {
    if (autoFocus) onFocusConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    setEditing(false)
    if (draft !== bookmark.note) onUpdateNote(bookmark.id, draft)
  }

  return (
    <div className="flex items-center gap-2 rounded-standard px-2 py-1.5 text-sm hover:bg-white/5">
      <button
        onClick={() => onSeek(bookmark.timeSeconds)}
        className="shrink-0 font-bold text-accent-teal hover:underline"
        aria-label={`Jump to ${formatTimestamp(bookmark.timeSeconds)}`}
      >
        {formatTimestamp(bookmark.timeSeconds)}
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="flex-1 rounded bg-surface-2 px-2 py-0.5 text-text outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(bookmark.note)
            committedRef.current = false
            setEditing(true)
          }}
          className="flex-1 truncate text-left text-text hover:text-accent-teal"
        >
          {bookmark.note || <span className="text-muted">Add a note…</span>}
        </button>
      )}
      {onShare && (
        <button onClick={onShare} aria-label="Copy link to this moment" className="shrink-0 text-muted hover:text-accent-teal">
          {justCopied ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
        </button>
      )}
      <button onClick={() => onDeleteRequest(bookmark)} aria-label="Delete bookmark" className="shrink-0 text-muted hover:text-alert-red">
        <TrashIcon width={14} height={14} />
      </button>
    </div>
  )
}

export function BookmarksDrawer({
  bookmarks,
  expanded,
  onToggleExpanded,
  focusBookmarkId,
  onFocusConsumed,
  onSeek,
  onUpdateNote,
  onDeleteRequest,
  gameId,
  clipId,
}: BookmarksDrawerProps) {
  const [copiedBookmarkId, setCopiedBookmarkId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)

  const handleShare = async (bookmark: Bookmark) => {
    if (!gameId) return
    try {
      await navigator.clipboard.writeText(buildMomentShareUrl(gameId, clipId, bookmark.timeSeconds))
      setCopiedBookmarkId(bookmark.id)
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = window.setTimeout(() => setCopiedBookmarkId(null), 1500)
    } catch (error) {
      console.error('Failed to copy share link', error)
    }
  }

  return (
    <div className="border-t border-white/10">
      <button
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted hover:text-text"
      >
        <span>Bookmarks ({bookmarks.length})</span>
        <span>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="max-h-40 overflow-auto px-1 pb-2">
          {bookmarks.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted">No bookmarks yet.</p>
          ) : (
            bookmarks.map((b) => (
              <BookmarkRow
                key={b.id}
                bookmark={b}
                autoFocus={b.id === focusBookmarkId}
                onFocusConsumed={onFocusConsumed}
                onSeek={onSeek}
                onUpdateNote={onUpdateNote}
                onDeleteRequest={onDeleteRequest}
                onShare={gameId ? () => handleShare(b) : null}
                justCopied={copiedBookmarkId === b.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
