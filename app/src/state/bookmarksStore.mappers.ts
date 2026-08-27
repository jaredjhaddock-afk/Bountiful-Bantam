export interface Bookmark {
  id: string
  clipId: string
  timeSeconds: number
  note: string
}

export interface BookmarkRow {
  id: string
  clip_id: string
  time_seconds: number
  note: string
}

export function rowToBookmark(row: BookmarkRow): Bookmark {
  return { id: row.id, clipId: row.clip_id, timeSeconds: row.time_seconds, note: row.note }
}

export function bookmarkToInsertRow(bookmark: Bookmark, teamId: string, createdBy: string | null) {
  return {
    id: bookmark.id,
    team_id: teamId,
    clip_id: bookmark.clipId,
    created_by: createdBy,
    time_seconds: bookmark.timeSeconds,
    note: bookmark.note,
  }
}
