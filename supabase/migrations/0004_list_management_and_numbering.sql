-- Adds sort order (formations, plays) and a persistent, coach-editable play number.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run),
-- the same way 0001-0003 were run. Not executed by the app or by Claude — the anon/publishable
-- key has no schema-modification permission, and the backfill below needs the dashboard
-- session's elevated access to run against existing rows.

alter table formations add column sort_order integer not null default 0;
alter table plays add column sort_order integer not null default 0;
alter table plays add column number integer not null default 0;

-- Backfill existing rows so nothing visually reorders and every existing play ends up with a
-- real, distinct number instead of the placeholder 0 the column default above leaves it at.
-- Both follow each row's existing created_at order, scoped per team+unit (matching this
-- phase's "one global order per unit" and "numbers are per unit" decisions).
with ranked_formations as (
  select id, row_number() over (partition by team_id, unit order by created_at) - 1 as rn
  from formations
)
update formations set sort_order = ranked_formations.rn
from ranked_formations
where formations.id = ranked_formations.id;

with ranked_plays as (
  select id, row_number() over (partition by team_id, unit order by created_at) - 1 as rn
  from plays
)
update plays set sort_order = ranked_plays.rn, number = ranked_plays.rn + 1
from ranked_plays
where plays.id = ranked_plays.id;
