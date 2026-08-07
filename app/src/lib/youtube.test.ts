import { describe, expect, it } from 'vitest'
import { parseYouTubeId } from './youtube'

describe('parseYouTubeId', () => {
  it('parses a standard watch URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses a youtu.be short URL', () => {
    expect(parseYouTubeId('https://youtu.be/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses an embed URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('parses a bare 11-character video id', () => {
    expect(parseYouTubeId('aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
  })

  it('returns null for an unparseable string', () => {
    expect(parseYouTubeId('not a url')).toBeNull()
  })
})
