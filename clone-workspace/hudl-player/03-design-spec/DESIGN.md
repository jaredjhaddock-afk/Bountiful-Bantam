# DESIGN.md — Hudl-style Video Review Player (reference: app.hudl.com/watch/.../analyze)

## Visual Theme

A dense, professional broadcast/analytics tool. Deep navy-black surfaces, cool blue-gray text, and a single bright electric-blue accent reserved for active/interactive states. The video is the hero — the player itself has near-invisible chrome (controls fade in on hover, dark scrim), while the surrounding app shell (nav, clip library, play-breakdown grid) is data-dense with small, precise typography. This is a tool built for frame-accurate, repeated review, not casual viewing — every control favors precision (5-second jump, single-frame step, clip-bound trim handles) over flashy motion.

## Colors

| Role | Value | Evidence |
|---|---|---|
| App/panel background (darkest) | `rgb(15, 18, 21)` / `#0F1215` | computed archetype |
| Secondary dark panel | `rgb(33, 38, 43)` / `#21262B` | computed archetype |
| Deep panel variant | `rgb(25, 31, 36)` | computed archetype |
| Muted navy surface | `rgb(54, 72, 92)` / `#36485C` | dominant, 610 nodes — likely the breakdown-grid header/toolbar tone |
| Secondary navy | `rgb(58, 77, 95)` | computed archetype |
| Primary text (light blue-gray) | `rgb(192, 198, 205)` / `#C0C6CD` | dominant, 611 nodes |
| Muted text | `rgb(133, 144, 158)` / `#85909E` | 279 nodes |
| Near-white text | `rgb(254, 254, 254)` | 105 nodes |
| **Accent — bright blue** | `rgb(10, 147, 245)` / `#0A93F5` | 10 occurrences — active states, links |
| Accent blue (secondary) | `rgb(2, 115, 227)` | 3 occurrences |
| Row-highlight tint | `rgba(230, 242, 255, 0.4)` | selected breakdown-grid row |
| Scrub-bar played fill | orange (visually observed, ~`#E8720C`–`#F08C1C` range) | screenshot evidence — distinct from the blue accent, used only for the timeline |

Note: the timeline's "played" color is a warm orange, deliberately different from the app's blue accent — likely so progress reads clearly against the video content itself.

## Typography

- **Font:** `barlow, helvetica, sans-serif` — dominant across 1621 nodes. (Interesting overlap with Playmaker's "Barlow Condensed" — both sports-coaching tools converge on a condensed, technical-feeling sans.)
- **Weights:** 500 (dominant, 937 nodes, body/labels), 700 (658 nodes, headings/emphasis), 400 (rare, 26 nodes).
- **Sizes:** heavily dominated by **12px** (1204 nodes — the breakdown-grid's dense tabular data), then 16px (243, body/nav), 14px (151, secondary), 10px (fine print), one 64px (a hero/empty-state number).

## Spacing & Radius

- Radii: **2px** dominant (86 occurrences — buttons, badges), 8px and 4px and 6px (cards/panels), 50% (circular icon buttons), 30% (21 occurrences — a rounded-square variant, possibly avatar or team-logo frames).

## Layout — Video Player Region (the part in scope)

- **Scrub bar:** thin horizontal track, orange "played" fill, a **white circular handle at each extreme end** — these bound the current clip within the longer reel and are the natural mechanism for an in/out trim range (confirmed by position; drag behavior not tested).
- **Transport row** (revealed on hover, hidden otherwise): skip-to-prev-clip → fast-reverse → single-step-back → jump-back-5s → play/pause → jump-forward-5s → single-step-forward → fast-forward → skip-to-next-clip → collapse chevron. All icon-only, no text labels, evenly spaced, centered under the video.
- **Fast-reverse/forward are click-based one-shot seeks in this build** (jumped ~6s then resumed normal playback) — **not** a press-and-hold variable-speed scrub. No dedicated slow-motion control was found. This is a meaningful finding: our app's hold-for-0.4x/4x requirement is **our own spec**, going beyond what Hudl's actual player does — Hudl is a layout/visual reference here, not a behavioral one for this specific feature.
- **Right-side tool cluster:** keyboard-shortcuts, picture-in-picture, loop-repeat toggle, quality-selector badge, mute, fullscreen — all icon-only, right-aligned, same row as the collapse chevron.
- **No telestration/drawing entry point was found** in this pass (see `interaction-map.json` → `unreached`). Our drawing tool is independently spec'd from the user's own requirements.

## Design Guardrails

- **Do** keep the video player's own chrome minimal and hover-revealed — controls should not compete with the footage.
- **Do** use a distinct color for the scrub-bar progress fill (warm orange) versus the app's interactive-accent blue, so timeline state and UI state read as separate signals.
- **Do** favor small, icon-only, evenly-spaced transport controls in a single centered row — this reads as "professional tool," not "consumer video app."
- **Don't** assume Hudl's fast-reverse/forward buttons are a hold-to-scrub interaction — they are not, in this build. Build the user's actual requested behavior (hold = slow/fast scrub, release = pause) as new interaction design, using this layout only as a visual/positional reference.
- **Don't** try to replicate the play-breakdown data grid or clip library — those are out of scope for "the video player."

## Agent Prompt Guide

To build in this visual language: near-black navy surfaces (`#0F1215`/`#21262B`), light blue-gray text (`#C0C6CD`), Barlow/Helvetica sans at a small 12-16px scale, a bright blue accent (`#0A93F5`) reserved for interactive/active state only, 2px-radius controls, an orange progress-fill on the scrub bar (distinct from the blue accent), and a minimal, icon-only, hover-revealed transport row centered under the video.
