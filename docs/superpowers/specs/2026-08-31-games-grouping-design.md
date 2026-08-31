# Video Review: Games & Practices Grouping — Design Spec

## Problem

Every saved clip today lives in one flat list in the Video Review library, with no way
to say "these three clips are all from the 8/29 game against Corner Canyon." A coach
with clips from several weeks of film has no way to jump back to a specific week's
game and see just its clips (and their bookmarked notes) together.

## Goals

- Let a coach group clips under a "Game" — a date, an optional opponent, and an
  optional custom label (for practices, scrimmages, etc. that don't have an opponent).
- Make Games the primary way to navigate Video Review: land on a list of games, open
  one to see its clips (and, per clip, its bookmarks — unchanged from today).
- New clips added while inside a game are assigned to that game automatically. A clip
  can also be moved to a different game (or unassigned) after the fact.
- Clips saved before this feature ships, or added without picking a game, land in an
  "Unassigned" bucket — nothing about existing data breaks or requires migration.

## Non-goals (out of scope for this spec)

- Sharing a game with another coach (a link that opens a specific game/play) — a
  separate, later phase that builds on top of this one.
- Any distinction in *behavior* between "game" and "practice" beyond the label a coach
  types in. No separate type enum, no type-based filtering — `opponent` being empty is
  enough to tell a practice apart from a game when it matters, and nothing in this
  spec's goals asks for filtering by that.
- Bulk-assigning existing "Unassigned" clips to a game in one action. A coach can move
  clips one at a time via the same per-clip "move to a different game" control that
  handles corrections generally — a dedicated bulk-move UI isn't asked for and would be
  speculative scope right now.

## Data model

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references profiles(id),
  date date not null,
  opponent text,
  name text,
  created_at timestamptz not null default now()
);

alter table games enable row level security;

create policy "team-scoped select games" on games for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert games" on games for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update games" on games for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete games" on games for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

alter table clips add column game_id uuid references games(id) on delete set null;
```

`game_id` is nullable and `on delete set null` (not cascade) — deleting a game
un-assigns its clips rather than deleting them; a coach's saved film and bookmarks are
never silently destroyed by a game-management action. `opponent` and `name` are both
nullable: a practice might set only `name` ("Tuesday walkthrough"), a game might set
only `opponent`, and a coach can set both if they want a custom label on top of the
opponent.

Display label, computed client-side rather than stored redundantly: if `opponent` is
set, `"<date> vs <opponent>"`; else `name || "<date>"`.

## UX

### Games list (new primary entry point)

Replaces the flat clip grid as what a coach sees first when opening Video Review. A
grid of game cards (same visual language as today's clip cards — date-sorted,
newest first), each showing the computed label and a clip count. An "Unassigned"
pseudo-game card always appears, pinned last after the date-sorted real games (it's a
catch-all, not a game a coach scheduled), showing clips with `game_id = null` — so
nothing from before this feature ships becomes invisible.

An "+ Add Game" control opens a small form: date (defaults to today), opponent
(optional), name (optional). No source/video picking here — a game starts empty;
clips get added to it from inside.

### Inside a game

Clicking a game card shows that game's clips — the existing clip-grid UI
(`ClipLibrary`'s card rendering, source icon, bookmark-count badge — all unchanged),
filtered to `clip.gameId === this game's id` (or `== null` for the "Unassigned"
pseudo-game). "+ Add Video" from inside a game runs through the existing
add-video flow exactly as today, except the resulting clip is created with
`game_id` set to the currently-open game's id (or left `null` inside "Unassigned").

Each clip card gets a small "move to a different game" control (a compact dropdown of
existing games, plus "Unassigned") for correcting a wrong assignment or sorting an
old ungrouped clip into a game after the fact — the one place bulk-assignment's job
gets done manually, one clip at a time, per the non-goals above.

### Back navigation

The existing back-arrow in `AppShell` currently returns straight to the flat library
from the player. It now needs one more level: player → clip grid (inside a game) →
games list. `VideoReviewPage`'s `mode` state machine grows a `game`-scoped clip-list
mode alongside `games`/`add`/`player`, carrying which game is currently open.

## State management

A new `useGames()` hook, structured exactly like the existing `useClips()` — a
`GamesProvider`/context (not a per-item hook like bookmarks, since the games list is
used across the Games list, the "move to a different game" dropdown, and the add-video
flow's game-assignment, all at once — matching why `clips`/`playbook` are contexts
while `bookmarks` deliberately isn't). Exposes `games`, `loading`, `createGame`,
`updateGame`, `deleteGame`. Immediate writes (optimistic local state + fire-and-forget
Supabase call, `console.error` on failure), matching `createClip`/`updateClip`.

`clipsStore`'s `Clip` type gains `gameId: string | null`; `createClip` gains an
optional `gameId` parameter (defaulting to `null`) so the add-video flow can assign it
at creation time; a new `moveClipToGame(clipId, gameId: string | null)` handles the
per-clip reassignment control.

## Testing

- `gamesStore.mappers.ts` (row↔app-object mapping) and the `GamesProvider`/`useGames()`
  hook get tests via the same mocked-Supabase-client pattern already used for
  `clipsStore.test.tsx`/`bookmarksStore.test.tsx`.
- `clipsStore`'s `createClip`/`moveClipToGame` additions get tests the same way.
- The display-label computation (`opponent` set vs. `name` only vs. neither) is pure
  and gets its own small tested helper module, following the `bookmarkUtils.ts`
  pattern from the prior phase.

## Process note (not part of the design itself)

Next migration number is `0006` (`0005` was the video-bookmarks feature, already
merged to `main`).
