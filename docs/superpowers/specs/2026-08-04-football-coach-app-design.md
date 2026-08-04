# Football Coaching App — Design Spec

## Purpose

A web app for football coaches and players with two core features:
1. **Video Review Player** — watch game tape on loop with frame-accurate scrub controls, mark in/out points, and telestrate (draw) over the footage.
2. **Playbook / Playmaker** — build and organize offensive/defensive/special-teams plays with a drag-and-diagram editor, shared with the team.

## Platform & Scope Decisions (from brainstorming)

- **Web app**, responsive (not native mobile). PWA-installable later if desired.
- **Auth/teams**: single team, simple login (email + shared team code). No multi-team org management for v1.
- **Video storage**: sources are *referenced*, not uploaded.
  - YouTube: embedded via the YouTube iframe API.
  - Google Drive: file picker UI exists; a real OAuth/Picker connection is a v1.1 follow-up (not built yet).
  - Local device file: plays via a browser blob URL. **Known limitation**: the file never leaves the browser, so it cannot sync to teammates or persist across sessions — only YouTube/Drive-sourced clips are shareable, since those are just URLs/IDs, not bytes.
- **Drawing tools**: freehand pen only, with color and stroke-width controls, plus a reset/clear action. (No shape/arrow/text tools in v1.)
- **Playbook scope**: drag-and-drop player icons on a field, route drawing per player (click-to-place-waypoint, not drag), route-type styling, formation presets, three units (Offense/Defense/Special Teams), Categories (Run/Pass/Uncategorized) as an independent filter axis, and a reusable Formation + Route Tree template gallery.

## Visual Identity

**Adopt the Playmaker charcoal/teal system app-wide** (chosen over Hudl's navy/blue, or a new blend). This replaces the navy/blue palette used in the standalone Hudl-style player prototype.

| Token | Value |
|---|---|
| App background | `#161A1D` |
| Panel / surface | `#1F272E` |
| Toolbar / slide-up bars | `#3A434D` |
| Secondary surface | `#323B45` |
| Muted text/icon | `#5A6470` |
| Primary text | `#FFFFFF` |
| Hover/press overlay | `rgba(255,255,255,0.07)` |
| **Accent (routes, active states, primary actions)** | `#00746B` (teal) |
| Font | `"Barlow Condensed", Tahoma, sans-serif` (400/500/700) |
| Radius | 3px standard, 50% circular (player tokens, avatar-style icons) |

The video player's scrub-bar progress fill keeps a **distinct warm color** (not teal) so timeline progress reads separately from interactive/active-state color — reuse the orange (`#E8720C`) from the Hudl prototype for this one purpose only.

Full reference details: [`clone-workspace/playmaker-editor/03-design-spec/DESIGN.md`](../../clone-workspace/playmaker-editor/03-design-spec/DESIGN.md) and [`clone-workspace/hudl-player/03-design-spec/DESIGN.md`](../../clone-workspace/hudl-player/03-design-spec/DESIGN.md).

## Architecture

**Single Vite + React + TypeScript + Tailwind CSS app**, replacing the two standalone prototype projects (`clones/playmaker-editor`, `clones/hudl-player`), reusing their verified components after restyling to the teal system.

```
app/
├── src/
│   ├── main.tsx, App.tsx           # top-level nav: Video Review | Playbook
│   ├── styles/globals.css          # single teal/charcoal token system
│   ├── lib/supabase.ts             # Supabase client
│   ├── auth/                       # login (email + team code), session context
│   ├── types/                      # Play, Formation, Clip, etc.
│   ├── components/
│   │   ├── layout/AppShell.tsx     # shared top-level shell + nav
│   │   ├── player/                 # from clones/hudl-player, restyled
│   │   │   ├── VideoStage, ScrubBar, ControlBar, DrawingCanvas, VideoPlayerPage
│   │   └── playbook/ + editor/ + templates/   # from clones/playmaker-editor
│   └── pages/
│       ├── VideoReviewPage.tsx     # clip library (shared clips) + player
│       └── PlaybookPage.tsx        # existing playbook list/editor/templates
```

**Backend: Supabase** (Postgres + Auth + Row-Level Security).

```
teams            (id, name, join_code)
users            (id, team_id, email, display_name)
formations       (id, team_id, unit, name, players jsonb)
categories       (id, team_id, unit, name)
plays            (id, team_id, unit, formation_id, category_id, name,
                   players jsonb, annotations jsonb, position_notes jsonb)
clips            (id, team_id, created_by, source_type['youtube'|'drive'],
                   source_ref text, title, in_point real, out_point real,
                   drawing_strokes jsonb)
```

RLS policy: all rows scoped to `team_id = auth user's team`. Local-file clips are **never** written to `clips` (nothing to reference) — they stay a client-only, non-persistent viewing mode.

## Feature Integration Notes

- **Nav**: two top-level sections sharing one `AppShell` (header, team name, user menu). Video Review's clip library becomes a real list backed by `clips` (replacing the prototype's single-video-only flow); Playbook's list/editor/templates carry over largely as-is.
- **Route-drawing and telestration interaction models are already validated** by direct testing (Playmaker: click-to-place-waypoint; video player: freehand pen with reset) — no further UX exploration needed there, just restyling and backend wiring.
- **Hold-to-scrub (slow/fast reverse & forward)** is an original interaction we designed (Hudl's real player doesn't do this) — implementation already proven against both a local file and a YouTube embed; carries over as-is, restyled.

## Known Limitations Carried Forward

- Local video files are session-only and non-shareable (explicit tradeoff from the video-storage decision).
- Google Drive is UI-only until OAuth/Picker credentials are set up.
- Reverse playback on YouTube is seek-simulated and visibly choppier than a local file or forward playback — inherent to the YouTube iframe API, not fixable client-side.
