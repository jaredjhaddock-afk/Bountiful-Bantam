import type { Stroke } from '../types/video'

export type ClipSourceType = 'youtube' | 'drive' | 'file'

export interface Clip {
  id: string
  sourceType: ClipSourceType
  sourceRef: string
  title: string | null
  inPoint: number | null
  outPoint: number | null
  drawingStrokes: Stroke[]
}

export interface ClipRow {
  id: string
  source_type: string
  source_ref: string
  title: string | null
  in_point: number | null
  out_point: number | null
  drawing_strokes: Stroke[]
}

export function rowToClip(row: ClipRow): Clip {
  return {
    id: row.id,
    sourceType: row.source_type as ClipSourceType,
    sourceRef: row.source_ref,
    title: row.title,
    inPoint: row.in_point,
    outPoint: row.out_point,
    drawingStrokes: row.drawing_strokes ?? [],
  }
}

export function clipToInsertRow(clip: Clip, teamId: string) {
  return {
    id: clip.id,
    team_id: teamId,
    source_type: clip.sourceType,
    source_ref: clip.sourceRef,
    title: clip.title,
  }
}

export function clipToUpdateRow(clip: Clip) {
  return {
    title: clip.title,
    in_point: clip.inPoint,
    out_point: clip.outPoint,
    drawing_strokes: clip.drawingStrokes,
  }
}
