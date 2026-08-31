import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDriveFileBlob, requestDriveAccessToken } from './googleDrive'

export type DriveBlobState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'needs-connect' }
  | { status: 'error'; message: string }

/** Resolves a Google Drive file id to a playable blob URL. Pass `null` for `fileId`
 *  when the current source isn't a Drive clip — the hook stays idle and does nothing.
 *
 *  Tries an unauthenticated fetch first (works when the file is shared "anyone with the
 *  link"); on failure, moves to `needs-connect` rather than an error, since the common
 *  case is simply "not shared with this viewer," not a real failure. `connect()` runs
 *  the OAuth popup and retries with the resulting token.
 *
 *  `initialAccessToken`, when given, is used for the very first fetch instead of the
 *  unauthenticated attempt — set by VideoSourceModal right after a fresh Picker
 *  selection, so the person who just picked the file never sees a "connect" prompt for
 *  their own new clip. It's read only once per mount (the effect depends on `fileId`
 *  alone): the clip identity — and so this hook's mount — is stable for the lifetime of
 *  one player session (VideoPlayerPage is keyed by clip id), so there's no case where
 *  it needs to be re-applied mid-session. */
export function useDriveVideoBlob(fileId: string | null, initialAccessToken?: string) {
  const [state, setState] = useState<DriveBlobState>(fileId ? { status: 'loading' } : { status: 'idle' })
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fileId) {
      setState({ status: 'idle' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetchDriveFileBlob(fileId, initialAccessToken)
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setState({ status: 'ready', url })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'needs-connect' })
      })
    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  const connect = useCallback(() => {
    if (!fileId) return
    setState({ status: 'loading' })
    requestDriveAccessToken()
      .then((token) => fetchDriveFileBlob(fileId, token))
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setState({ status: 'ready', url })
      })
      .catch(() => setState({ status: 'error', message: 'Could not connect to Google Drive. Try again.' }))
  }, [fileId])

  return { state, connect }
}
