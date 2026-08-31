import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDriveFileBlob } from './googleDrive'

describe('fetchDriveFileBlob', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the API key (no Authorization header) when no access token is given', async () => {
    const mockBlob = new Blob(['video bytes'])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDriveFileBlob('file-123')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file-123?alt=media&key=test-api-key',
      undefined,
    )
    expect(result).toBe(mockBlob)
  })

  it('uses an Authorization header (no API key) when an access token is given', async () => {
    const mockBlob = new Blob(['video bytes'])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) })
    vi.stubGlobal('fetch', fetchMock)

    await fetchDriveFileBlob('file-123', 'my-token')

    expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/drive/v3/files/file-123?alt=media', {
      headers: { Authorization: 'Bearer my-token' },
    })
  })

  it('throws when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchDriveFileBlob('file-123')).rejects.toThrow('403')
  })
})
