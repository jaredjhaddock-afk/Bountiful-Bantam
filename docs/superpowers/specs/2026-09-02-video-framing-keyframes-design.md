# Video framing keyframes (pan/zoom)

## Problem

Game film is often shot wide (whole formation, whole field), which makes it hard to
see the specific detail a coach wants to point out — a route, a block, a footwork
issue. There's currently no way to zoom in on part of the frame at all.

## Approach

A per-clip list of **framing keyframes** — each one a 16:9 rectangle (a sub-region of
the video's frame) tied to a timestamp. During normal playback, the video smoothly
pans/zooms between whichever two keyframes surround the current time (linear
interpolation — a continuous "Ken Burns" move, not a jump cut). Before the first
keyframe, the video shows the full, unzoomed frame; at and after the last keyframe, it
holds that keyframe's exact framing rather than snapping back out — so a single
keyframe alone is a complete, useful action ("zoom in here and stay zoomed"), not a
rect that flashes for a single instant and reverts.

This works uniformly across every clip source (local file, YouTube, Drive) because it's
implemented as one CSS transform on the layer that already wraps whatever `VideoStage`
renders (a `<video>` element or a YouTube iframe) — the effect never needs to know or
care which kind of clip it's zooming into.

## Creating and editing keyframes

A new **Frame** toggle in the control bar (next to the existing Draw toggle, and
mutually exclusive with it — both claim pointer/drag input on the video area) enters
framing-edit mode:

- While active, the video always shows the full frame (no live zoom applied), so the
  coach can see the whole picture while placing a keyframe.
- Dragging on the video draws a rectangle from the press point to the release point,
  constrained to a 16:9 ratio as you drag (the drag distance sets the box's width; its
  height is always derived to keep 16:9, so you can't draw a mismatched shape).
- Releasing saves that rectangle as a keyframe at whatever timestamp is currently
  playing (same "capture the current moment" idea the existing Bookmark button already
  uses).
- Existing keyframes are drawn as faint outlines while in edit mode. Dragging inside an
  existing keyframe's outline adjusts that same keyframe's rectangle instead of creating
  a new, separate one at a slightly different time.
- A "Reset zoom" action, visible only in edit mode, deletes all of a clip's keyframes in
  one step (a plain, unzoomed clip is the state before any keyframes existed, so this is
  just "start over," not a partial undo).

Keyframe timestamps also show as small markers on the scrub bar (new to `ScrubBar`, not
tied to how bookmarks are shown), so it's easy to see and click back to where a keyframe
sits.

## Data model

Each clip gains a `framingKeyframes` field: an array of
`{ id: string; timeSeconds: number; x: number; y: number; width: number; height: number }`.
`x`/`y`/`width`/`height` are fractions (0–1) of the video's own rendered box at the
moment the keyframe was drawn — not pixels, and not fractions of the source file's
native resolution — so the same keyframe reproduces the same relative framing
regardless of what size the player happens to be displayed at later (windowed vs.
fullscreen, different screen sizes, etc.).

Persisted via a new `framing_keyframes` jsonb column on `clips` (default `[]`), using
the exact same debounced auto-save path `VideoPlayerPage` already uses for trim points
and drawing strokes — no new save mechanism, no explicit save action for the coach to
remember.

## Rendering the zoom

Given the currently-interpolated rect (`x, y, width, height`, all fractions), the
element wrapping the video (and the drawing overlay — annotations pan/zoom together
with the video, staying pinned to what they're pointing at) gets:

```
transform-origin: 0 0;
transform: scale(1 / width) translate(calc(x * -100%), calc(y * -100%));
```

(`1 / width` is the scale factor for both axes, not just the horizontal one, because
every keyframe's rectangle is locked to the same 16:9 ratio as the video's own rendered
box — so `width` and `height` always scale by the same amount.)

Outside of edit mode, this is computed fresh on every `currentTime` update from the two
surrounding keyframes. It resolves to the identity transform (`x:0, y:0, width:1,
height:1` — full frame, no zoom) whenever `currentTime` falls before the first keyframe,
or the clip has no keyframes at all. At or after the last keyframe's timestamp, it holds
that keyframe's own rect.

## Non-goals

- No easing curves — interpolation between keyframes is linear only.
- No "hold" at a keyframe before moving to the next one — continuous interpolation the
  whole time.
- No copying framing keyframes between clips.
- No interaction with framing during Draw mode or vice versa (mutually exclusive
  toggles).
