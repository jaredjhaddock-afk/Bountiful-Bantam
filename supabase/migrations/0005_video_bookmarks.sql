-- Adds bookmarked-moment support to Video Review, plus a 'file' source type for local
-- device files so they can have bookmarks too (see the design spec for why local files
-- need a clips row despite never having a real video reference).
-- Run this once in the Supabase SQL Editor, the same way 0001-0004 were run. Not
-- executed by the app or by Claude — the anon/publishable key has no schema-modification
-- permission.

alter table clips drop constraint clips_source_type_check;
alter table clips add constraint clips_source_type_check check (source_type in ('youtube', 'drive', 'file'));

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
