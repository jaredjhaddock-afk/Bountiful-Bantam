import type { FramingKeyframe, Stroke } from '../types/video'

export type ClipSourceType = 'youtube' | 'drive' | 'file'

export interface Clip {
  id: string
  sourceType: ClipSourceType
  sourceRef: string
  title: string | null
  inPoint: number | null
  outPoint: number | null
  drawingStrokes: Stroke[]
  framingKeyframes: FramingKeyframe[]
  gameId: string | null
}

export interface ClipRow {
  id: string
  source_type: string
  source_ref: string
  title: string | null
  in_point: number | null
  out_point: number | null
  drawing_strokes: Stroke[]
  framing_keyframes: FramingKeyframe[]
  game_id: string | null
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
    framingKeyframes: row.framing_keyframes ?? [],
    gameId: row.game_id,
  }
}

export function clipToInsertRow(clip: Clip, teamId: string) {
  return {
    id: clip.id,
    team_id: teamId,
    source_type: clip.sourceType,
    source_ref: clip.sourceRef,
    title: clip.title,
    game_id: clip.gameId,
  }
}

export function clipToUpdateRow(clip: Clip) {
  return {
    title: clip.title,
    in_point: clip.inPoint,
    out_point: clip.outPoint,
    drawing_strokes: clip.drawingStrokes,
    framing_keyframes: clip.framingKeyframes,
    game_id: clip.gameId,
  }
}
