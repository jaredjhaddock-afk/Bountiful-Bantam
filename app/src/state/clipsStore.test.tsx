import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ClipsProvider, useClips } from './clipsStore'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', teamId: 'test-team', displayName: 'Test' } }),
}))

const EXISTING_FILE_CLIP = {
  id: 'clip-existing',
  source_type: 'file',
  source_ref: 'cam1ghxcccos.mp4:104857600',
  title: 'cam1ghxcccos.mp4',
  in_point: null,
  out_point: null,
  drawing_strokes: [],
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ order: () => Promise.resolve({ data: table === 'clips' ? [EXISTING_FILE_CLIP] : [], error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <ClipsProvider>{children}</ClipsProvider>

describe('findOrCreateFileClip', () => {
  it('reuses the existing clip when the fingerprint matches an already-loaded file clip', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let found
    act(() => {
      found = result.current.findOrCreateFileClip('cam1ghxcccos.mp4:104857600', 'cam1ghxcccos.mp4')
    })
    expect(found!.id).toBe('clip-existing')
    expect(result.current.clips).toHaveLength(1)
  })

  it('creates a new clip when no existing file clip matches the fingerprint', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let created
    act(() => {
      created = result.current.findOrCreateFileClip('cam2ghxccthusg.mp4:685836697', 'cam2ghxccthusg.mp4')
    })
    expect(created!.sourceType).toBe('file')
    expect(created!.sourceRef).toBe('cam2ghxccthusg.mp4:685836697')
    expect(result.current.clips).toHaveLength(2)
  })

  it('does not match a different file with the same name but a different size', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let found
    act(() => {
      found = result.current.findOrCreateFileClip('cam1ghxcccos.mp4:999999999', 'cam1ghxcccos.mp4')
    })
    expect(found!.id).not.toBe('clip-existing')
  })

  it('does not create a duplicate clip when called twice in a row for the same fingerprint before a re-render', async () => {
    const { result } = renderHook(() => useClips(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let first
    let second
    act(() => {
      first = result.current.findOrCreateFileClip('cam3newfile.mp4:55555555', 'cam3newfile.mp4')
      second = result.current.findOrCreateFileClip('cam3newfile.mp4:55555555', 'cam3newfile.mp4')
    })
    expect(second!.id).toBe(first!.id)
  })
})
