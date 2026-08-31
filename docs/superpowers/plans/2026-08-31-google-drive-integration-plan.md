# Google Drive Video Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Google Drive source tab actually work — a coach picks a video from their Drive via Google's OAuth + Picker, and it plays with full trim/bookmark/scrub support like any other clip. Other coaches who already have view access to that Drive file watch it with no login prompt; anyone who doesn't gets a "Connect Google Drive" prompt instead of an error.

**Architecture:** A new `googleDrive.ts` library wraps Google's client-side APIs (Identity Services for OAuth, Picker for file selection, Drive API v3 for content). A new `useDriveVideoBlob` hook resolves a Drive file id to a blob URL — trying an unauthenticated (public-link) fetch first, falling back to an OAuth-gated retry. `VideoStage` renders a resolved Drive clip through the exact same `<video>` element already used for local-file clips, so no new playback-control code path is needed once resolved.

**Tech Stack:** React + TypeScript, Vitest, Google Identity Services (`accounts.google.com/gsi/client`), Google Picker API (`apis.google.com/js/api.js`), Google Drive API v3 (REST, fetched directly — no `gapi.client` library needed).

---

### Task 1: `googleDrive.ts` — script loading, OAuth, Picker, and file content fetch

**Files:**
- Create: `app/src/lib/googleDrive.ts`
- Test: `app/src/lib/googleDrive.test.ts`

- [ ] **Step 1: Write the failing tests for `fetchDriveFileBlob`**

```ts
// app/src/lib/googleDrive.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `app/`): `npx vitest run src/lib/googleDrive.test.ts`
Expected: FAIL — `Failed to resolve import "./googleDrive"`

- [ ] **Step 3: Write the implementation**

```ts
// app/src/lib/googleDrive.ts
declare global {
  interface Window {
    google?: any
    gapi?: any
  }
}

let apiPromise: Promise<void> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = src
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error(`Failed to load script ${src}`))
    document.head.appendChild(tag)
  })
}

function loadPicker(): Promise<void> {
  return loadScript('https://apis.google.com/js/api.js').then(
    () => new Promise((resolve) => window.gapi.load('picker', () => resolve())),
  )
}

/** Loads Google Identity Services and the Picker API once, idempotently — mirrors the
 *  existing `loadYouTubeIframeAPI` pattern in `./youtube.ts`. */
export function loadGoogleApis(): Promise<void> {
  if (window.google?.accounts?.oauth2 && window.google?.picker) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadPicker()]).then(() => undefined)
  return apiPromise
}

function requireEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  if (!value) throw new Error(`Missing ${name} environment variable`)
  return value
}

/** Opens Google's OAuth popup requesting the narrowest Drive scope (`drive.file`),
 *  which only grants access to whatever the user explicitly picks via the Picker below
 *  — not their whole Drive. Resolves with a short-lived access token, or rejects if the
 *  user denies/closes the popup. */
export function requestDriveAccessToken(): Promise<string> {
  return loadGoogleApis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: requireEnv('VITE_GOOGLE_CLIENT_ID'),
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error) reject(new Error(response.error))
            else resolve(response.access_token)
          },
        })
        tokenClient.requestAccessToken()
      }),
  )
}

export interface DrivePickedFile {
  fileId: string
  name: string
  sizeBytes: number
}

/** Opens Google's Picker UI, filtered to video files. Resolves with the picked file, or
 *  `null` if the user cancels without picking. */
export function openDrivePicker(accessToken: string): Promise<DrivePickedFile | null> {
  return loadGoogleApis().then(
    () =>
      new Promise<DrivePickedFile | null>((resolve) => {
        const view = new window.google.picker.View(window.google.picker.ViewId.DOCS_VIDEOS)
        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(requireEnv('VITE_GOOGLE_API_KEY'))
          .setCallback((data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0]
              resolve({ fileId: doc.id, name: doc.name, sizeBytes: Number(doc.sizeBytes) || 0 })
            } else if (data.action === window.google.picker.Action.CANCEL) {
              resolve(null)
            }
          })
          .build()
        picker.setVisible(true)
      }),
  )
}

/** Fetches a Drive file's content as a Blob. With no `accessToken`, this is the public
 *  path — works only if the file is shared "anyone with the link can view," using the
 *  API key alone. With a token, it's the authenticated path — works for any file the
 *  token's grant covers, regardless of sharing settings. */
export async function fetchDriveFileBlob(fileId: string, accessToken?: string): Promise<Blob> {
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
  const url = accessToken ? base : `${base}&key=${requireEnv('VITE_GOOGLE_API_KEY')}`
  const res = await fetch(url, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined)
  if (!res.ok) throw new Error(`Failed to fetch Drive file (${res.status})`)
  return res.blob()
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/googleDrive.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Verify the rest of the suite and types are unaffected**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass (the 3 new ones plus every existing test).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/googleDrive.ts app/src/lib/googleDrive.test.ts
git commit -m "Add googleDrive: OAuth token, Picker, and file content fetch helpers"
```

---

### Task 2: `useDriveVideoBlob` hook and the `VideoSource` type addition

**Files:**
- Modify: `app/src/types/video.ts`
- Create: `app/src/lib/useDriveVideoBlob.ts`

- [ ] **Step 1: Add the transient `driveAccessToken` field to `VideoSource`**

Edit `app/src/types/video.ts` — change:

```ts
export interface VideoSource {
  type: VideoSourceType
  url: string
  youtubeId?: string
  fileName?: string
  fileSize?: number
}
```

to:

```ts
export interface VideoSource {
  type: VideoSourceType
  url: string
  youtubeId?: string
  fileName?: string
  fileSize?: number
  /** Only meaningful for a freshly-picked 'drive' source, set once by VideoSourceModal
   *  right after a successful Picker selection so the very first playback resolution
   *  can skip straight to the authenticated fetch. Never persisted — clip mappers don't
   *  read this field, so it never reaches Supabase. */
  driveAccessToken?: string
}
```

- [ ] **Step 2: Write `useDriveVideoBlob`**

```ts
// app/src/lib/useDriveVideoBlob.ts
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
```

- [ ] **Step 3: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass (this hook has no dedicated test — it's stateful, effectful glue code wrapping the already-tested `googleDrive.ts` functions, matching this codebase's existing convention of not unit-testing hooks like `useHoldScrub`).

- [ ] **Step 4: Commit**

```bash
git add app/src/types/video.ts app/src/lib/useDriveVideoBlob.ts
git commit -m "Add useDriveVideoBlob hook and driveAccessToken on VideoSource"
```

---

### Task 3: Wire Drive playback into `VideoStage`

**This is the highest-risk task in the plan** — it changes the `MediaController` imperative-handle contract that `ControlBar`, `ScrubBar`, `BookmarksDrawer`, and `useHoldScrub` all rely on. Give this one full spec-compliance + code-quality subagent review, not the lighter direct-verification pass used for this plan's other tasks.

**Files:**
- Modify: `app/src/components/player/VideoStage.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { MediaController, VideoSource } from '../../types/video'
import { loadYouTubeIframeAPI } from '../../lib/youtube'
import { useDriveVideoBlob } from '../../lib/useDriveVideoBlob'
import { DriveIcon } from '../icons'

interface VideoStageProps {
  source: VideoSource
  onDurationChange: (d: number) => void
  onTimeUpdate: (t: number) => void
  onPlayingChange: (playing: boolean) => void
}

export const VideoStage = forwardRef<MediaController, VideoStageProps>(function VideoStage(
  { source, onDurationChange, onTimeUpdate, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const [ytReady, setYtReady] = useState(false)

  const driveFileId = source.type === 'drive' ? source.url : null
  const { state: driveState, connect: connectDrive } = useDriveVideoBlob(
    driveFileId,
    source.type === 'drive' ? source.driveAccessToken : undefined,
  )

  useEffect(() => {
    if (source.type !== 'youtube' || !source.youtubeId) return
    let cancelled = false
    loadYouTubeIframeAPI().then(() => {
      if (cancelled || !ytContainerRef.current) return
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: source.youtubeId,
        playerVars: { controls: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            setYtReady(true)
            onDurationChange(ytPlayerRef.current.getDuration())
          },
          onStateChange: (e: any) => {
            onPlayingChange(e.data === 1)
          },
        },
      })
    })
    return () => {
      cancelled = true
      ytPlayerRef.current?.destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, source.youtubeId])

  useEffect(() => {
    if (source.type !== 'youtube' || !ytReady) return
    const id = window.setInterval(() => {
      const t = ytPlayerRef.current?.getCurrentTime?.()
      if (typeof t === 'number') onTimeUpdate(t)
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, ytReady])

  // A resolved Drive clip plays through the exact same <video> element/ref as a 'file'
  // clip — once `driveState.status === 'ready'`, there's no meaningful difference
  // between the two source types from the player controls' point of view.
  const usesVideoElement = source.type === 'file' || (source.type === 'drive' && driveState.status === 'ready')

  useImperativeHandle(
    ref,
    (): MediaController => ({
      play: () => {
        if (usesVideoElement) videoRef.current?.play()
        else if (source.type === 'youtube') ytPlayerRef.current?.playVideo?.()
      },
      pause: () => {
        if (usesVideoElement) videoRef.current?.pause()
        else if (source.type === 'youtube') ytPlayerRef.current?.pauseVideo?.()
      },
      seekTo: (seconds: number) => {
        if (usesVideoElement && videoRef.current) videoRef.current.currentTime = seconds
        else if (source.type === 'youtube') ytPlayerRef.current?.seekTo?.(seconds, true)
      },
      getCurrentTime: () => {
        if (usesVideoElement) return videoRef.current?.currentTime ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getCurrentTime?.() ?? 0
        return 0
      },
      getDuration: () => {
        if (usesVideoElement) return videoRef.current?.duration ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getDuration?.() ?? 0
        return 0
      },
    }),
    [usesVideoElement, source.type],
  )

  if (source.type === 'drive' && driveState.status !== 'ready') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center text-muted">
        <DriveIcon width={28} height={28} />
        {driveState.status === 'loading' && <p className="text-xs">Loading from Google Drive…</p>}
        {driveState.status === 'needs-connect' && (
          <>
            <p className="px-6 text-xs">This video isn't shared with you yet.</p>
            <button onClick={connectDrive} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
              Connect Google Drive
            </button>
          </>
        )}
        {driveState.status === 'error' && (
          <>
            <p className="px-6 text-xs text-scrub-fill">{driveState.message}</p>
            <button onClick={connectDrive} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
              Try again
            </button>
          </>
        )}
      </div>
    )
  }

  if (source.type === 'youtube') {
    return <div ref={ytContainerRef} className="h-full w-full" />
  }

  const videoSrc = source.type === 'drive' && driveState.status === 'ready' ? driveState.url : source.url

  return (
    <video
      ref={videoRef}
      src={videoSrc}
      className="h-full w-full bg-black"
      onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onPlay={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      playsInline
    />
  )
})
```

- [ ] **Step 2: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/player/VideoStage.tsx
git commit -m "Play resolved Drive clips through the same video element as file clips"
```

---

### Task 4: Working "Connect Google Drive" button in `VideoSourceModal`

**Files:**
- Modify: `app/src/components/source/VideoSourceModal.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import { useRef, useState } from 'react'
import type { VideoSource } from '../../types/video'
import { parseYouTubeId } from '../../lib/youtube'
import { openDrivePicker, requestDriveAccessToken } from '../../lib/googleDrive'
import { DriveIcon, UploadIcon, YoutubeIcon } from '../icons'

interface VideoSourceModalProps {
  onSelect: (source: VideoSource) => void
}

export function VideoSourceModal({ onSelect }: VideoSourceModalProps) {
  const [tab, setTab] = useState<'youtube' | 'file' | 'drive'>('youtube')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleYoutubeSubmit = () => {
    const id = parseYouTubeId(youtubeUrl.trim())
    if (!id) {
      setError('Could not parse a video from that link.')
      return
    }
    setError(null)
    onSelect({ type: 'youtube', url: youtubeUrl.trim(), youtubeId: id })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onSelect({ type: 'file', url: URL.createObjectURL(file), fileName: file.name, fileSize: file.size })
  }

  const handleConnectDrive = async () => {
    setDriveError(null)
    setDriveConnecting(true)
    try {
      const token = await requestDriveAccessToken()
      const picked = await openDrivePicker(token)
      if (!picked) return
      onSelect({ type: 'drive', url: picked.fileId, fileName: picked.name, fileSize: picked.sizeBytes, driveAccessToken: token })
    } catch {
      setDriveError('Could not connect to Google Drive. Try again.')
    } finally {
      setDriveConnecting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[520px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-4 text-lg font-bold text-text">Load game tape</h1>
        <div className="mb-4 flex gap-1 rounded-standard bg-app-bg p-1">
          {(
            [
              ['youtube', 'YouTube', YoutubeIcon],
              ['file', 'Device / Photos', UploadIcon],
              ['drive', 'Google Drive', DriveIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-standard py-2 text-sm ${
                tab === key ? 'bg-toolbar text-text' : 'text-muted hover:bg-white/5'
              }`}
            >
              <Icon width={16} height={16} /> {label}
            </button>
          ))}
        </div>

        {tab === 'youtube' && (
          <div>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mb-2 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-teal"
            />
            {error && <p className="mb-2 text-xs text-scrub-fill">{error}</p>}
            <button onClick={handleYoutubeSubmit} className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white">
              Load video
            </button>
          </div>
        )}

        {tab === 'file' && (
          <div className="flex flex-col items-center gap-3 rounded-standard border border-dashed border-white/15 py-8">
            <UploadIcon width={28} height={28} />
            <p className="text-xs text-muted">Select a video from your device or Photos library</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white"
            >
              Choose file
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {tab === 'drive' && (
          <div className="flex flex-col items-center gap-3 rounded-standard border border-dashed border-white/15 py-8 text-center">
            <DriveIcon width={28} height={28} />
            <p className="px-6 text-xs text-muted">Pick a video from your Google Drive.</p>
            {driveError && <p className="px-6 text-xs text-scrub-fill">{driveError}</p>}
            <button
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {driveConnecting ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types and tests**

Run (from `app/`): `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/source/VideoSourceModal.tsx
git commit -m "Replace disabled Drive button with a working Connect + Picker flow"
```

---

### Task 5: Final check and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run (from `app/`):

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test 2>&1 | tail -6 && npx oxlint 2>&1 | tail -10
```

Expected: no type errors, all tests pass (91 existing + 3 new `googleDrive.test.ts` tests), no new lint warnings beyond the pre-existing `unicorn(no-thenable)` warnings in test-mock builder files.

- [ ] **Step 2: Manual browser verification (blocked on Google Cloud Console setup)**

This step cannot be exercised until `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` exist in `app/.env.local` (dev) and Vercel's project environment variables (prod) — a separate walkthrough, not part of this plan. Once those exist:

1. Open Video Review → Add Video → Google Drive tab → "Connect Google Drive". Confirm Google's OAuth popup appears, and after granting, Google's Picker opens filtered to video files.
2. Pick a video. Confirm it opens in the player immediately with working trim, scrub, and bookmark controls — no "connect" prompt for the person who just picked it.
3. Reload the page and reopen that same clip from the clip library. If the file is shared "anyone with the link," confirm it plays immediately with no prompt. If not, confirm the "This video isn't shared with you yet" prompt appears instead of an error, and that clicking "Connect Google Drive" and re-granting successfully plays it.
4. Share that game (using the existing share-link feature) with a second Google account signed into a different browser profile, and confirm the same shared-vs-not-shared behavior holds for them.
5. Cancel the Picker without selecting a file — confirm the modal just stays on the Drive tab with no error.

- [ ] **Step 3: Report results**

No commit for this task — report the check output and, once Google Cloud credentials exist, the manual verification results.
