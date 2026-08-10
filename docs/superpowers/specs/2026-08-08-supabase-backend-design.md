# Supabase Backend — Design Spec

## Purpose

Add real persistence, auth, and team-sharing to the merged app (`app/`), replacing today's in-memory-only playbook state and giving the video review feature a real shareable clip library (for YouTube/Drive sources — local files remain session-only per the original video-storage decision).

## Decisions (from this session's Q&A)

- **Hosting:** Vercel (a separate, later step). This spec covers the Supabase side only.
- **Backend:** Supabase (Postgres + Auth), talked to directly from the browser via `@supabase/supabase-js`. No custom server — matches the app's existing plain-Vite-SPA architecture. Row Level Security (RLS) is the only access-control layer; there is no server to trust instead.
- **Auth method:** Magic link (passwordless email). User enters an email, gets a one-time sign-in link, clicks it, they're in. No passwords to manage.
- **Team joining:** After first login, a user with no team yet sees a "join your team" screen and enters a short join code (e.g. `BANTAM-B7X2`). This calls a `join_team` Postgres function that links their profile to the team. Matches the original "single team, simple login" decision — there's no self-serve team *creation* UI in this pass; a team's first join code is created by inserting a row directly (the user, as the sole team owner, does this once via the Supabase SQL editor when setting up their team — documented in the migration).
- **Formations/categories scope:** Expanded from the original merge plan's "keep as static built-ins" — formations and categories are now real, team-owned, database-backed rows, editable per team (not just plays and clips). This is a real scope increase over the original design spec and supersedes that section.

## Credentials

- **Project URL** and **Publishable (anon) key**: safe for client-side use, stored as Vite env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in `app/.env.local` (gitignored, never committed).
- **Database password** and **`service_role`/secret key**: never given to or used by the app or by Claude. All schema setup happens via SQL the user runs themselves in the Supabase SQL Editor (provided as a migration file in this repo) — this keeps the most powerful credentials out of both the codebase and this conversation.

## Schema

```sql
-- teams: one row per team. join_code is what new members type in to link their account.
teams (id uuid pk, name text, join_code text unique, created_at timestamptz)

-- profiles: 1:1 with auth.users, created automatically on signup via trigger.
-- team_id is null until the user completes the join-code step.
profiles (id uuid pk references auth.users, team_id uuid references teams, display_name text, created_at timestamptz)

-- formations: team-owned, per unit (offense/defense/specialTeams). players is the
-- same shape the app already uses (array of {id,label,role,x,y}).
formations (id uuid pk, team_id uuid references teams, unit text, name text, players jsonb, created_at timestamptz)

-- categories: team-owned, per unit (Run/Pass/Uncategorized today, but now editable).
categories (id uuid pk, team_id uuid references teams, unit text, name text, created_at timestamptz)

-- plays: the actual content coaches create. players/annotations/position_notes
-- mirror the app's existing Play type exactly (see app/src/types/play.ts).
plays (id uuid pk, team_id uuid references teams, created_by uuid references profiles,
       unit text, formation_id uuid references formations, category_id uuid references categories,
       name text, players jsonb, annotations jsonb, position_notes jsonb,
       created_at timestamptz, updated_at timestamptz)

-- clips: video review clips with a shareable source (YouTube/Drive only — local
-- files can't be referenced, per the original video-storage decision).
clips (id uuid pk, team_id uuid references teams, created_by uuid references profiles,
       source_type text check (in 'youtube','drive'), source_ref text, title text,
       in_point real, out_point real, drawing_strokes jsonb, created_at timestamptz)
```

**RLS:** every table except `teams` is scoped by `team_id = (select team_id from profiles where id = auth.uid())` for all operations. `teams` itself has no general SELECT policy (a user can't browse teams) — the only way to associate with a team is the `join_team(p_join_code)` function, which runs as `security definer` so it can look up a team by code and write the caller's `profiles.team_id` without needing a broad SELECT policy on `teams`.

## Client Architecture

```
app/src/
├── lib/supabaseClient.ts       # NEW — creates the supabase-js client from env vars
├── auth/
│   ├── AuthProvider.tsx        # NEW — session state, wraps the app
│   ├── LoginScreen.tsx         # NEW — email input → magic link sent
│   └── JoinTeamScreen.tsx      # NEW — join-code entry for profiles with team_id = null
├── state/
│   ├── playbookStore.tsx       # MODIFIED — formations/categories/plays now fetched from
│   │                             and written to Supabase instead of static/in-memory data
│   └── clipsStore.tsx          # NEW — clip library CRUD against the `clips` table
```

`App.tsx` gains an auth gate: unauthenticated → `LoginScreen`; authenticated but no team → `JoinTeamScreen`; authenticated with a team → today's nav-switched app, now backed by real data.

## Out of Scope (this spec)

- Vercel deployment (separate follow-up).
- Google Drive OAuth (still just a UI stub).
- Self-serve team *creation* (a team's first join code is seeded via SQL, not a signup flow) — only single-team use is supported today, matching the original decision.
- Local-file clip persistence (technically impossible without uploading bytes, which was explicitly rejected earlier).
