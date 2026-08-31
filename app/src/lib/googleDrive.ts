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
