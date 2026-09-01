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
 *  user denies/closes the popup.
 *
 *  Mobile browsers (Safari in particular) only allow a popup to open when it's triggered
 *  synchronously within a real tap — if the Google Identity Services script hasn't loaded
 *  yet, the `await loadGoogleApis()` below can take long enough that the browser no
 *  longer considers the eventual `requestAccessToken()` call part of that tap, and
 *  silently blocks the popup with no error callback at all. Callers should call
 *  `loadGoogleApis()` ahead of time (e.g. as soon as the Drive tab is selected, well
 *  before the user actually taps Connect) so this resolves near-instantly by the time
 *  it's actually invoked. The timeout below is the safety net for when that still isn't
 *  enough — without it, a blocked popup leaves the caller hanging forever with no
 *  feedback, which is exactly what silently happened before this was added. */
export function requestDriveAccessToken(): Promise<string> {
  return loadGoogleApis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        let settled = false
        const timeoutId = window.setTimeout(() => {
          if (settled) return
          settled = true
          reject(new Error('Google sign-in did not respond — your browser may have blocked the popup.'))
        }, 15000)

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: requireEnv('VITE_GOOGLE_CLIENT_ID'),
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
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

// A Google OAuth Client ID is formatted as `<project number>-<random>.apps.googleusercontent.com`
// — this pulls the project number back out rather than duplicating it as a separate constant
// that could silently drift out of sync with the real client ID.
function googleCloudProjectNumber(): string {
  const clientId = requireEnv('VITE_GOOGLE_CLIENT_ID')
  const projectNumber = clientId.split('-')[0]
  if (!projectNumber || !/^\d+$/.test(projectNumber)) {
    throw new Error('Could not determine the Google Cloud project number from VITE_GOOGLE_CLIENT_ID')
  }
  return projectNumber
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
          // Required with the `drive.file` scope: without it, a file picked here can end up
          // not actually linked to this OAuth client's grant, so the very next authenticated
          // fetch for that same file (right after picking it) gets rejected as if it were
          // never shared at all.
          .setAppId(googleCloudProjectNumber())
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
