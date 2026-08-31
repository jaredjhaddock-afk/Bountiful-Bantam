# Game sharing — deep links to a game or a specific moment

## Problem

A coach wants to send a teammate straight to a game's clips and notes, or to one
specific tagged moment inside a clip ("X ran wrong route"), without walking them
through the Games list by hand.

## Audience & scope

Same-team coaches only — no public or token-based access model. A recipient must
already be signed in (or sign in) as a member of the same team; existing Supabase
RLS (`team_id` scoping) is the only access control needed, since a link is just a
pointer to data the recipient's own account can already query. Sharing outside the
team is out of scope.

## Approach

No new backend table, no new client-side router dependency. Links are built and
read entirely on the client, using existing state already loaded into the app.

**Link shape:** query params on the app's own URL —
`?game=<gameId>` (game-level) or `?game=<gameId>&clip=<clipId>&t=<seconds>`
(moment-level, points at one bookmark).

**Producing a link:** a "Share" affordance on each game card in `GamesLibrary`
copies a game-level link. A "Share" affordance on each row in `BookmarksDrawer`
copies a moment-level link built from that bookmark's clip and `timeSeconds`.
Both use `window.location.origin + pathname` plus the built query string, copied
via the clipboard API. No server round-trip.

**Consuming a link:** on initial page load, `shareLink.ts` parses the current
URL's query params once and — because the user may not be signed in yet, and
Supabase's magic-link auth redirect does not reliably preserve arbitrary query
params — the parsed target is stashed in `sessionStorage` immediately, before
the auth gate resolves. Once `AuthenticatedApp` mounts (session + team profile
loaded), it reads and clears that stashed target once:

1. Force `section = 'video'`.
2. If `games` (from `useGames`) contains the target `game` id, open it (same as
   clicking the game card) instead of showing the Games list.
3. If a `clip` id is also present and found among that game's clips, open it
   (same as clicking the clip card) instead of showing the clip list. File-type
   clips go through the existing file-picker reopen flow unchanged — the
   recipient sees the original filename as the clip's title and is prompted to
   pick the matching file from their own device/Drive, exactly like reopening
   any local-file clip today.
4. If `t` is also present, pass it to `VideoPlayerPage` as `initialSeekTime`,
   which seeks once `duration` becomes known (mirrors the existing
   default-outPoint-on-duration effect).

If the `game` id isn't found (wrong team, deleted game, stale link) — or a
`clip` id isn't found within that game — the app falls back to whatever level
of navigation it could resolve (game found but clip not: land on that game's
clip list; game not found: land on the normal Games list). No error screen; a
bad or stale link just degrades to normal browsing.

The consumed target is cleared from `sessionStorage` after use and the query
params are stripped from the URL (`history.replaceState`) so back-navigation
within the app afterward behaves like any normal session.

## Components

- `app/src/lib/shareLink.ts` (new) — pure functions: `buildGameShareUrl(gameId)`,
  `buildMomentShareUrl(gameId, clipId, timeSeconds)`,
  `parseShareParams(search): {gameId, clipId, timeSeconds} | null`. Unit tested.
- A tiny bootstrap read (module scope, runs once at import time in `main.tsx`,
  before `App` renders) stashes `parseShareParams(window.location.search)` into
  `sessionStorage`.
- `App.tsx` (`AuthenticatedApp`) — reads and clears the stashed target once
  profile/team are available, forces `section = 'video'` when a target exists.
- `VideoReviewPage.tsx` — accepts an optional pending target (prop from
  `App.tsx`), resolves it against `games`/the selected game's clips once they're
  loaded, and drives `handleOpenGame`/`handleOpenClip` the same way a click
  would.
- `VideoPlayerPage.tsx` — new optional `initialSeekTime?: number` prop; seeks
  once via the existing `seekTo` path when `duration > 0`.
- `GamesLibrary.tsx` — a share icon per game card, calls `buildGameShareUrl` and
  copies to clipboard; brief inline confirmation (e.g. icon swaps to a checkmark
  for ~1.5s), no modal.
- `BookmarksDrawer.tsx` — a share icon per bookmark row, calls
  `buildMomentShareUrl` and copies to clipboard with the same brief confirmation.

## Non-goals

- No sharing with people outside the team, no public/anonymous access.
- No expiring or revocable links (nothing to revoke — it's a pointer into
  data already gated by team membership, not a granted permission).
- No change to how local-file clips are stored, fingerprinted, or reopened —
  the existing reopen-via-file-picker flow is reused as-is for recipients.
- No browser back/forward history integration beyond this one entry-point
  read; in-app navigation stays the existing `useState` mode machine.
- Clip-only links (no bookmark) aren't a separate case — sharing "a clip"
  without a specific moment is just a game-level link followed by picking that
  clip from the list.
