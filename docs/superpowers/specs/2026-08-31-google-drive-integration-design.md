# Google Drive video integration

## Problem

The "Google Drive" source tab in Video Review is a non-functional placeholder — both the
"Connect Google Drive" button in `VideoSourceModal` and the player's Drive branch in
`VideoStage` show a static "not available in this demo" message. Now that the app has
real users, this needs to actually work: a coach should be able to pick a video already
sitting in their Google Drive and use it exactly like a YouTube or uploaded clip (trim,
bookmark, scrub).

## Access model

- **Selecting a file (the uploading coach):** requires a one-time-per-session Google
  OAuth grant, scoped to `drive.file` — the narrowest Drive scope, which only grants
  access to whatever the person explicitly picks in Google's own Picker dialog. This
  scope does not require Google's app-verification review process.
- **Watching an existing Drive clip (any teammate, including the uploader on a later
  visit):** the app first tries to fetch the video with **no OAuth prompt at all**, via
  an API-key-only request to the Drive API's content endpoint. This succeeds
  automatically if the uploader shared the file as "anyone with the link can view."
  Only if that fails does the app fall back to prompting that viewer to connect their
  own Google account (same OAuth popup as selection), matching the original ask: a
  Drive link "just works" if the viewer already has access, and only asks for a
  reconnect when it doesn't.
- No support for pasting a raw Drive share link as an alternative input — selection is
  exclusively through the OAuth + Picker flow.
- No refresh-token persistence. Each browser session's Drive connection is a fresh
  popup-granted access token (via Google Identity Services' token client), used only
  for the duration of that session. No server-side token storage — this app has no
  backend beyond Supabase, and nothing here needs one.

## What you need to set up (Google Cloud Console — user-only steps)

Before any of this can be exercised end-to-end, a real Google Cloud project needs:
1. Drive API and Picker API enabled.
2. An OAuth 2.0 Client ID (Web application type), with the dev and production origins
   authorized (no redirect URI needed — Google Identity Services' token client is a
   popup flow, not redirect-based).
3. An OAuth consent screen configured with the `drive.file` scope. Since this scope is
   non-sensitive, publishing to Production does not require Google's manual review.
4. An API key (restricted to the Drive API, and to the app's HTTP referrers), used both
   to initialize the Picker and for the no-auth public-file content fetch.
5. Two new env vars, following the existing `VITE_SUPABASE_*` pattern:
   `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` — added to `app/.env.local` and to
   Vercel's project environment variables.

This is a separate walkthrough (like the earlier Vercel/Supabase deployment steps),
tracked outside this spec.

## Architecture

**New file: `app/src/lib/googleDrive.ts`** — all Google API surface area lives here,
mirroring the existing `lib/youtube.ts` script-loader pattern:
- `loadGoogleApis(): Promise<void>` — loads the Google Identity Services script and the
  Picker API script once, idempotently.
- `requestDriveAccessToken(): Promise<string>` — opens the OAuth popup via
  `google.accounts.oauth2.initTokenClient`, resolves with an access token or rejects if
  the user closes/denies the popup.
- `openDrivePicker(accessToken: string): Promise<{ fileId: string; name: string; sizeBytes: number } | null>`
  — opens Google's Picker UI scoped to video files, resolves with the picked file (or
  `null` if cancelled).
- `fetchDriveFileBlob(fileId: string, accessToken?: string): Promise<Blob>` — fetches
  file content from `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`,
  using `key=<API key>` when no token is given (public-file path) or an
  `Authorization: Bearer` header when a token is given (authenticated path). Throws on
  a non-OK response (the caller decides what that means — see below).

**`VideoSourceModal.tsx`** — the Drive tab's disabled button is replaced with a working
"Connect Google Drive" button: on click, requests an access token, opens the Picker, and
on a successful pick calls `onSelect({ type: 'drive', url: fileId, fileName: name, fileSize: sizeBytes })` —
identical shape to how the file/YouTube tabs already call `onSelect`. `sourceRef` for a
Drive clip is the Drive file ID, matching how YouTube clips store `youtubeId` as
`sourceRef`.

**Playback resolution — a new hook, `useDriveVideoBlob`, used by `VideoStage`:** when
`source.type === 'drive'`, this hook drives a small state machine:
1. `loading` — try `fetchDriveFileBlob(fileId)` with no token (the public path).
2. On success — turn the blob into an object URL and hand back a resolved,
   `file`-shaped playback URL.
3. On failure — move to a `needs-connect` state: render a "Connect your Google Drive to
   watch this" prompt (not an error). Clicking it calls `requestDriveAccessToken()` and
   retries `fetchDriveFileBlob(fileId, token)`; success moves to the resolved state,
   failure shows a plain retry with an error message.

**`VideoStage.tsx`** — the existing `source.type === 'file'` branch (a plain `<video>`
element) already provides full scrub/trim/bookmark support via the existing
`MediaController` interface. Rather than adding a third, parallel implementation of that
interface for Drive, the Drive branch resolves to a blob URL via `useDriveVideoBlob` and
then renders through the exact same `<video>` element/ref path the `file` branch uses —
so once resolved, a Drive clip *is* a file clip as far as playback controls are
concerned. While unresolved (`loading` or `needs-connect`), it renders the
loading/connect-prompt UI instead of the `<video>` element.

**Uploader's immediate trim/preview:** right after a successful Picker selection in
`VideoSourceModal`, the access token from that same OAuth grant is still fresh — the
first blob fetch for that new clip uses it directly (authenticated path) rather than
waiting to fall through the public-fetch-then-reconnect flow, so the person who just
picked the file never sees a "connect" prompt for their own just-added clip.

## Error handling

- Picker cancelled (user closes the dialog without picking) — no error, `VideoSourceModal`
  just stays on the Drive tab, same as if they'd cancelled a native file picker.
- OAuth popup blocked or denied — a plain inline error message on the Drive tab
  ("Couldn't connect to Google Drive — try again"), no crash.
- Public content fetch fails for a reason other than access (network error, Drive
  outage) — same "needs-connect" prompt is shown; clicking through to OAuth and
  retrying is the universal recovery path, since the app can't distinguish "not shared"
  from "transient failure" from a fetch failure alone, and prompting reconnect is a safe
  default either way.
- Blob fetch succeeds but the file isn't actually a playable video (wrong MIME type) —
  out of scope; the existing `<video>` element's native error handling applies, same as
  it would for a malformed local file today.

## Non-goals

- No raw share-link paste path (OAuth + Picker only, per the chosen approach).
- No refresh tokens / persistent Drive connection across sessions.
- No change to how YouTube or local-file clips work.
- No support for Drive folders, multiple-file selection, or non-video Drive files.
- No offline/download-for-later caching of Drive video bytes beyond the in-memory blob
  used for the current playback session.
