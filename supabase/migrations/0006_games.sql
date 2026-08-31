-- Adds a games table so clips can be grouped by game/practice, and browsing can be
-- game-first instead of one flat clip list. Run this once in the Supabase SQL Editor,
-- the same way 0001-0005 were run. Not executed by the app or by Claude — the
-- anon/publishable key has no schema-modification permission.

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

-- Deleting a game un-assigns its clips (set null) rather than deleting them — a
-- coach's saved film and bookmarks are never destroyed by a game-management action.
alter table clips add column game_id uuid references games(id) on delete set null;
