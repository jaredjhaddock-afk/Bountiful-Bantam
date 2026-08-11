-- Football Coach App — initial schema, RLS policies, and auth wiring.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
-- Uses only the anon/publishable key's normal permissions at runtime — this migration itself
-- runs with your dashboard session's elevated access, which is why it must be run manually
-- rather than by the app or by Claude (see docs/superpowers/specs/2026-08-08-supabase-backend-design.md).

-- ── Tables ──────────────────────────────────────────────────────────────────

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references teams(id),
  display_name text,
  created_at timestamptz not null default now()
);

create table formations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  unit text not null check (unit in ('offense', 'defense', 'specialTeams')),
  name text not null,
  players jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  unit text not null check (unit in ('offense', 'defense', 'specialTeams')),
  name text not null,
  created_at timestamptz not null default now()
);

create table plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references profiles(id),
  unit text not null check (unit in ('offense', 'defense', 'specialTeams')),
  formation_id uuid references formations(id),
  category_id uuid references categories(id),
  name text not null,
  players jsonb not null default '[]',
  annotations jsonb not null default '[]',
  position_notes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clips (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references profiles(id),
  source_type text not null check (source_type in ('youtube', 'drive')),
  source_ref text not null,
  title text,
  in_point real,
  out_point real,
  drawing_strokes jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ── Auto-create a profile row when someone signs up via magic link ─────────

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Team join-by-code (security definer so it can look up a team by code ───
--    without needing a broad SELECT policy on teams) ───────────────────────

create function join_team(p_join_code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from teams where join_code = p_join_code;
  if v_team_id is null then
    raise exception 'Invalid join code';
  end if;
  update profiles set team_id = v_team_id where id = auth.uid();
end;
$$;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Every table is scoped to "rows belonging to my team". teams itself has no
-- SELECT policy — the only way in is join_team() above, which runs as the
-- table owner and bypasses RLS internally.

alter table teams enable row level security;
alter table profiles enable row level security;
alter table formations enable row level security;
alter table categories enable row level security;
alter table plays enable row level security;
alter table clips enable row level security;

create policy "select own profile" on profiles for select
  using (id = auth.uid());
create policy "select teammates' profiles" on profiles for select
  using (team_id is not null and team_id = (select team_id from profiles where id = auth.uid()));
create policy "update own profile" on profiles for update
  using (id = auth.uid());

create policy "team-scoped select formations" on formations for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert formations" on formations for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update formations" on formations for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete formations" on formations for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team-scoped select categories" on categories for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert categories" on categories for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update categories" on categories for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete categories" on categories for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team-scoped select plays" on plays for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert plays" on plays for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update plays" on plays for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete plays" on plays for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team-scoped select clips" on clips for select
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped insert clips" on clips for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped update clips" on clips for update
  using (team_id = (select team_id from profiles where id = auth.uid()));
create policy "team-scoped delete clips" on clips for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

-- ── Your team ────────────────────────────────────────────────────────────
-- Creates the one team this app currently supports (see design spec — no
-- self-serve team creation yet). Pick your own join code before running.

insert into teams (name, join_code) values ('Bantam B', 'BANTAM-B7X2');
