-- Fixes "infinite recursion detected in policy for relation \"profiles\"" (surfaces to the app
-- as a 500 on every fetch of the signed-in user's own profile — nobody can ever get past the
-- Gate). Run this once in the Supabase SQL Editor, same as 0001/0002.
--
-- Root cause: the "select teammates' profiles" policy on `profiles` does a subquery back into
-- `profiles` to look up the caller's own team_id. Evaluating that subquery re-applies every
-- select policy on `profiles` — including this same policy — which subqueries `profiles` again,
-- and so on forever. Postgres detects the cycle and errors out instead of looping infinitely.
--
-- Fix: look up the caller's team_id via a `security definer` function instead of a raw subquery.
-- Security-definer functions run as the function's owner (the table owner, same as `join_team`
-- in 0001_init.sql), which bypasses RLS entirely on the query inside the function body — so the
-- lookup no longer re-triggers the policy that's asking for it.

create function my_team_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select team_id from profiles where id = auth.uid();
$$;

drop policy "select teammates' profiles" on profiles;

create policy "select teammates' profiles" on profiles for select
  using (team_id is not null and team_id = my_team_id());
