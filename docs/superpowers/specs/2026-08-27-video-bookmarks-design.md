# Video Review: Time Display & Bookmarked Moments — Design Spec

## Problem

The Video Review player has no visible readout of the current playback time, and no way
to mark a specific moment in a game video with a note (e.g. "X ran wrong route",
"Defense blitzed") for later recall. A coach reviewing film today can only scrub blindly
and has no durable record of what happened when — they'd have to re-watch the whole clip
to find a moment again.

## Goals

- Show the current playback position (and total duration) at all times while reviewing.
- Let a coach mark the current moment with a short freeform text note ("bookmark" it),
  pausing the video and opening the note for immediate typing.
- Show a list of a clip's bookmarks (timestamp + note), collapsed by default, that a
  coach can expand, click through to jump straight to a moment, and edit or delete.
- Let a coach step between bookmarks using the physical Hudl-remote's Prev/Next buttons.
- Bookmarks must survive across sessions for **every** video source type the app
  supports — including local device files, which today are never saved anywhere.

## Non-goals (out of scope for this spec)

- No cross-clip bookmark search/browse view (e.g. "show every bookmark across the whole
  season"). Bookmarks are viewed per-clip only. A cross-clip view may be a future
  follow-up.
- No preset/category tags (e.g. "Blitz", "Missed Assignment") — notes are freeform text
  only.
- No remote binding for *creating* a bookmark. Creation is on-screen-button only; the
  remote's role is limited to navigating between bookmarks that already exist.
- No changes to the existing "Tag" button (remote `Digit8` / Ctrl+Shift+8) or its
  in/out-point trim behavior — that stays exactly as it is today.

## Naming clarification

There is already a "Tag" concept in this codebase (`VideoPlayerPage.tsx`'s `handleTag`)
that marks a clip's trim in/out points — unrelated to what this spec describes. To avoid
confusion, the feature described here is called a **Bookmark** everywhere: UI copy,
component names, the database table, and code comments.

## UX

### Time display

A `0:47 / 3:12`-style current/duration readout (`m:ss` — no hours component; game clips
are well under an hour), placed in the control bar next to the new Bookmark button.
Updates live from the same `currentTime`/`duration` state `VideoPlayerPage` already
tracks.

### Creating a bookmark

A new "Bookmark" button in `ControlBar`, on-screen only (no remote chord). Clicking it:

1. Pauses the video (matching the existing pause-on-interaction feel of trim controls).
2. Creates a bookmark at the current `currentTime`, with an empty note.
3. Expands the bookmarks drawer if it's collapsed.
4. Focuses that bookmark's note field for typing immediately.

Committing the note follows the same auto-focus / Enter-or-blur-commits pattern already
used for editing a play's number in `PlayCard.tsx` — no separate Save button. An empty
note is valid and can be filled in (or left blank) later.

### Bookmarks drawer

A bottom, collapsible drawer below the control bar (chosen over an always-visible side
panel after reviewing both options): a header reading `BOOKMARKS (N)` that toggles
expand/collapse, then one row per bookmark ordered by timestamp:

- Clicking the timestamp seeks the video there, preserving whatever play/pause state the
  video was already in (consistent with the existing scrub-bar seek behavior).
- Clicking the note text turns it into an editable input (same auto-focus/blur-commit
  pattern as creation). A blank note shows a muted "Add a note..." placeholder instead of
  empty space, so an unlabeled bookmark row still reads as populated rather than broken.
- A delete button per row opens the same `DeleteConfirmModal` component already used for
  formations and plays ("Delete this bookmark? This can't be undone.") — kept consistent
  with every other delete flow in the app, rather than a lighter one-click delete.

### Remote Prev/Next repurposed for bookmark navigation

`VideoPlayerPage`'s remote listener currently maps `Digit2`/`Digit3` to `onPrevClip`/
`onNextClip`, switching to the previous/next clip in the saved library. This spec
repurposes those two buttons: they now jump the playhead to the previous/next bookmark
(by timestamp) relative to the current position in the *current* clip. No-op if there
are no bookmarks, or already at the first/last one. Unlike bookmark creation, this does
not auto-expand the drawer — it's a quick seek during active review, not an entry point
for editing, so the drawer's open/closed state is left exactly as the coach had it.

This retires `onPrevClip`/`onNextClip` and the `handlePrevClip`/`handleNextClip`
callbacks in `VideoReviewPage.tsx` entirely — there is no on-screen equivalent for
clip-to-clip navigation today either, so this isn't removing a capability that exists
anywhere else; going back to the clip library and picking a different clip remains the
way to switch clips. This is a deliberate, user-confirmed tradeoff: bookmark navigation
during actual film review is more valuable than remote clip-switching.

## Local files: giving them a persistent identity

Today, picking a local file via "Device / Photos" never creates a `clips` row — the
comment in `VideoReviewPage.tsx` explains why: "Local files can't be referenced from
Supabase (the bytes never leave the browser)." That means bookmarks would have nowhere
to attach, and closing/reopening the same local file would lose everything.

This spec changes that: local files now get a lightweight `clips` row too, containing no
actual video reference (impossible for local bytes) but enough metadata to give
bookmarks somewhere to live and to let the same file be recognized again later:

- `source_type = 'file'`
- `source_ref = "<filename>:<sizeBytes>"` — e.g. `"cam1ghxcccos.mp4:104857600"`. This
  filename+size pair is a coincidental-collision risk (two unrelated files sharing both
  the same name and exact byte count would be treated as the same clip and share
  bookmarks) — a known, accepted, low-probability limitation, not something this spec
  guards against further.
- `title = filename`

Two distinct entry points, so fingerprint-matching only ever happens at one of them,
never both:

1. **Picking a file via "+ Add Video"**: check the fingerprint against existing
   `source_type='file'` clips for the team. A match reuses that clip's id (and its
   bookmarks); no match creates a new clip row.
2. **Reopening a local-file entry from the clip library**: clicking that entry prompts
   the native file picker ("Select `cam1ghxcccos.mp4` to continue"). Whatever file the
   coach picks plays under *that* clip's identity directly — no re-matching, since
   clicking the specific library entry already told the app which saved bookmark set is
   meant.

The clip library (`ClipLibrary.tsx`) needs to render local-file entries alongside
YouTube/Drive ones — filename as the title, a bookmark-count badge (a single query when
the library loads, counted client-side per `clip_id` — no new SQL function needed), and
the "select to continue" affordance instead of instant playback.

## Data model

New table, following the same shape and RLS pattern as every existing table:

```sql
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  clip_id uuid not null references clips(id) on delete cascade,
  created_by uuid references profiles(id),
  time_seconds real not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table bookmarks enable row level security;

create policy "team-scoped select bookmarks" on bookmarks for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert bookmarks" on bookmarks for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update bookmarks" on bookmarks for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete bookmarks" on bookmarks for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));
```

A real table (one row per bookmark) was chosen over a JSON array embedded on `clips`
(the way `drawing_strokes` works) because bookmarks are individually created, edited,
and deleted at different times, addressable by id — that maps cleanly onto normal rows
like `plays`/`formations`, not onto a single blob that gets wholesale-replaced each save.

## State management

A new `useClipBookmarks(clipId: string | null)` hook — **not** a global context/provider
like `playbookStore`/`clipsStore`. Bookmarks are only ever relevant to the one clip
currently open for review; there's no reason to eagerly load every clip's bookmarks the
way playbook data (used across many simultaneous views) is loaded. The hook:

- Fetches bookmarks for the given `clipId` (`select * from bookmarks where clip_id = ?
  order by time_seconds`) whenever `clipId` changes; returns `[]`/loading while
  `clipId` is null.
- Exposes `createBookmark(timeSeconds)`, `updateBookmarkNote(id, note)`,
  `deleteBookmark(id)`.
- All three use **immediate** writes — optimistic local state update, then a
  fire-and-forget Supabase call with `console.error` on failure — matching
  `createPlay`/`updatePlay`/`deletePlay`, not the debounced pattern used for drawing
  strokes and trim points (those debounce because they fire on every pointer-move;
  bookmark actions are discrete and comparatively rare).

`VideoReviewPage.tsx` owns the hook (it already owns `activeClip`) and threads
`bookmarks`/`createBookmark`/`updateBookmarkNote`/`deleteBookmark` down to
`VideoPlayerPage`, alongside a new prev/next-bookmark helper for the remote listener.

## Testing

- Pure logic — `formatTimestamp(seconds)` (`0:47`), and finding the nearest bookmark
  before/after a given time for remote Prev/Next — lands in a small testable helper
  module, same pattern as `listOrdering.ts` from the prior phase, unit-tested in
  isolation.
- `useClipBookmarks` gets tests via the same mocked-Supabase-client pattern already used
  for `playbookStore.test.tsx`/`clipsStore` tests: create/update/delete each write the
  right row and update local state correctly; fetching scopes correctly by `clip_id`.
- The local-file fingerprint find-or-create logic gets a test covering both the
  match-reuses-existing-clip and no-match-creates-new-clip paths.

## Process note (not part of the design itself)

`main` currently only has migrations through `0003`; the separate List Management
feature (migration `0004`) is still unmerged on its own branch. That branch should be
finished and merged before this feature's worktree is created, so this feature's
migration can be `0005` rather than colliding on the same number with an unmerged
branch.
