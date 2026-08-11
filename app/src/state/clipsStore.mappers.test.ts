import { describe, expect, it } from 'vitest'
import { clipToInsertRow, clipToUpdateRow, rowToClip } from './clipsStore.mappers'

describe('rowToClip', () => {
  it('maps a DB row to the app Clip shape', () => {
    const row = { id: '1', source_type: 'youtube', source_ref: 'abc123', title: 'Week 1', in_point: 2.5, out_point: 8, drawing_strokes: [] }
    expect(rowToClip(row)).toEqual({
      id: '1',
      sourceType: 'youtube',
      sourceRef: 'abc123',
      title: 'Week 1',
      inPoint: 2.5,
      outPoint: 8,
      drawingStrokes: [],
    })
  })

  it('defaults drawing_strokes to an empty array when null', () => {
    const row = { id: '1', source_type: 'youtube', source_ref: 'abc123', title: null, in_point: null, out_point: null, drawing_strokes: null as any }
    expect(rowToClip(row).drawingStrokes).toEqual([])
  })
})

describe('clipToInsertRow / clipToUpdateRow', () => {
  const clip = { id: '1', sourceType: 'youtube' as const, sourceRef: 'abc123', title: 'Week 1', inPoint: null, outPoint: null, drawingStrokes: [] }

  it('clipToInsertRow includes team_id and snake_case columns', () => {
    expect(clipToInsertRow(clip, 'team-1')).toEqual({
      id: '1',
      team_id: 'team-1',
      source_type: 'youtube',
      source_ref: 'abc123',
      title: 'Week 1',
    })
  })

  it('clipToUpdateRow maps trim points and drawings', () => {
    const withTrim = { ...clip, inPoint: 2, outPoint: 9 }
    expect(clipToUpdateRow(withTrim)).toEqual({ title: 'Week 1', in_point: 2, out_point: 9, drawing_strokes: [] })
  })
})
