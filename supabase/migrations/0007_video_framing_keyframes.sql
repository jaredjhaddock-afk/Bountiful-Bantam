-- Adds a jsonb column for per-clip pan/zoom framing keyframes, following the exact same
-- pattern as the existing drawing_strokes column: an array of small objects, defaulting
-- to empty, with no separate table needed. Run this once in the Supabase SQL Editor, the
-- same way 0001-0006 were run. Not executed by the app or by Claude — the anon/publishable
-- key has no schema-modification permission.

alter table clips add column framing_keyframes jsonb not null default '[]'::jsonb;
