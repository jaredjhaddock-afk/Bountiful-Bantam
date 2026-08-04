# DESIGN.md — Playmaker-style Play Editor (reference: tacklefootballplaymaker.com/app/)

## Visual Theme

A dense, dark, utilitarian sports-coaching tool. Near-black charcoal panels, minimal chrome, high-contrast white text and icons, and a single confident teal accent that does double duty as both the "skill position" player color and the default route-line color — so a coach's eye reads player-and-route as one continuous idea. Corners are barely rounded (3px) except player tokens, which are perfect circles. No gradients, no glassmorphism, no decorative shadows — flat, fast, functional. Density is high: toolbars are compact icon rows, panels slide up from the bottom rather than opening new pages, keeping the coach's attention on the field.

## Colors

| Role | Value | Evidence |
|---|---|---|
| App background (darkest) | `rgb(22, 26, 29)` / `#161A1D` | computed archetype, 6 nodes |
| Panel / surface background | `rgb(31, 39, 46)` / `#1F272E` | computed archetype, 19 nodes |
| Panel background (translucent) | `rgba(31, 39, 46, 0.4)` | computed archetype, 16 nodes |
| Toolbar background | `rgb(58, 67, 77)` / `#3A434D` | computed archetype |
| Secondary surface | `rgb(50, 59, 69)` / `#323B45` | computed archetype |
| Muted text / icon | `rgb(90, 100, 112)` / `#5A6470` | computed archetype |
| Primary text | `rgb(255, 255, 255)` | dominant, 1604 nodes |
| Secondary text | `rgb(216, 216, 216)` | computed archetype |
| Hover/press overlay | `rgba(255, 255, 255, 0.07)` | dominant overlay, 132 nodes |
| **Accent — teal (skill positions + routes)** | `rgb(0, 116, 107)` / `#00746B` | SVG stroke, 55 circle + 89 path occurrences — the signature color of the app |
| QB / center-of-play token | `rgb(144, 2, 3)` / `#900203` | SVG fill/stroke |
| Alert / bright red | `rgb(229, 1, 1)` | SVG path stroke |
| Lineman token (gray) | `rgb(77, 77, 77)` | SVG stroke, 20 occurrences |
| Lineman token (gray-blue) | `rgb(110, 125, 138)` | SVG path stroke, 16 occurrences |

No gradients or backdrop-filter effects were observed.

## Typography

- **Primary UI font:** `"Barlow Condensed", Tahoma, sans-serif` — weights 400 (body, dominant — 1279 nodes), 500 (218 nodes, emphasis/labels), 700 (91 nodes, headings/buttons).
- **Secondary font:** `Montserrat` weight 600 — sparse (~24 nodes), used for section headers/labels distinct from body copy.
- **Size scale (measured, most → least common):** 16px (dominant body/label size) → 17px → 18px → 14px (secondary/meta) → 24px (headings) → 20px → 12px (fine print/badges).
- Condensed font choice matches the dense, data-heavy sports-app aesthetic — favor a condensed sans for our own UI chrome too.

## Spacing Scale

Measured padding values cluster at: **5px, 10px, 15px, 20px, 40px**. Gaps: **5px, 8px, 10px**. Treat this as roughly a 5px base unit scale (5/10/15/20/40).

## Border Radius

- **3px** — standard for buttons, cards, panels (49 occurrences).
- **50%** — player tokens and any circular icon buttons.

## Shadows / Effects

Minimal use — the only shadow signature observed is a `0 0 0 2px` white focus-ring style outline (selection indicator on player tokens), not a drop shadow. No blur/backdrop-filter/glassmorphism in this app. Favor flat surfaces with color/opacity changes over shadow for our own depth cues.

## Motion

Not deeply measured in this pass; `prefers-reduced-motion` is respected (present in the measured media queries). Recommend short (150–250ms) ease transitions for panel slide-ups and toolbar reveals, consistent with the app's snappy, low-decoration feel.

## States

- **Hover/press:** `rgba(255,255,255,0.07)` overlay on dark surfaces — a subtle white wash, not a color shift.
- **Selection (player token):** white 2px ring outline around the selected circle.
- **Active tab/filter:** background lightens to the "secondary surface" tone (`#323B45`) vs. resting toolbar tone.

## Layout / Breakpoints (measured, not guessed)

Widths: `1919px, 1439px, 1279px, 1023px, 700px, 500px, 400px` · Heights: `629px, 500px` · plus `print` and `(prefers-reduced-motion: reduce)`. This is a much finer-grained responsive scale than the typical 768/375 guess — the app adapts continuously down to phone width rather than jumping between 2-3 fixed layouts.

## Assets

No byte-level asset/font downloads were performed in this pass (fonts are standard web fonts: Barlow Condensed, Montserrat, both available via Google Fonts). Icons are inline SVG, not an icon font or sprite sheet (97 `<svg>` elements observed, 0 `<canvas>`).

## Theme Tokens

Single dark theme only — no light-mode toggle or `prefers-color-scheme` response was found; this app is dark-only by design (typical for on-field / low-light coaching use).

## Design Guardrails

- **Do** use the teal accent for anything route/skill-position related — it's the app's single strongest visual signature. Reserve it; don't dilute it across unrelated UI.
- **Do** keep the editor canvas dark and low-chrome — the field and its diagram are the content; toolbars should recede (dark-on-dark, icon-only, no labels in the main canvas toolbar).
- **Do** use slide-up bottom panels for contextual tools (route style, annotations) rather than modals that cover the field — the coach needs to see the field while choosing a tool.
- **Do** keep corner radius small (3px) except for circular player tokens — avoid soft/rounded "friendly app" aesthetics; this is a utilitarian tool.
- **Don't** introduce gradients, drop shadows, or glassmorphism — flat color is the language here.
- **Don't** use light backgrounds for the editor canvas even if the rest of the app goes light — the field should stay dark for contrast with bright player/route colors regardless of overall theme.

## Agent Prompt Guide

To build in this design language from this file alone: dark charcoal (`#161A1D`/`#1F272E`) surfaces, white text, Barlow Condensed typography at a 16px base, a 5px spacing rhythm (5/10/15/20/40), 3px radius on rectangular elements and 50% on circular player tokens, a single teal (`#00746B`) accent tying player color to route color, flat surfaces with a 7%-white hover wash instead of shadows, and bottom slide-up panels for contextual tool selection instead of covering modals.
