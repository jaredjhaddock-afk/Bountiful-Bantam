# Formation Editor Enhancements — Design Spec

**Phase 1 of 3.** Phase 2 will redesign the play editor's field background (reusing the shared field component built here) and build the route-drawing/segment-styling engine. Phase 3 will fix the play editor toolbar (info, lock, mirror) and rebuild the annotations tool (route + text-box) on top of Phase 2's route engine. Those are out of scope for this document.

## Goals

The formation editor (`FormationCanvas.tsx`, `FormationEditorView.tsx`, `FormationsGallery.tsx`) currently lets you create a brand-new formation by arming a role button (QB/Skill/Lineman) and clicking the field to place generically-labeled tokens (S1, S2, ...). Editing an already-saved formation isn't possible — clicking a formation tile in the gallery does nothing. This phase replaces that flow with one closely matching the coach's reference screenshot of the real Playmaker editor: every new formation starts with all 11 standard tokens already placed at sensible default spots, named with real position letters, and clicking any token opens a Color & Label panel to rename/recolor/restyle it. Existing formations become editable. A new Mirror action duplicates a formation flipped left-right.

## New formation default layout

Creating a new formation ("+ New Formation") no longer starts blank. It immediately places all 11 tokens:

- **Line (5, fixed order):** LT, LG, C, RG, RT — squares, centered on the line of scrimmage, evenly spaced, in that left-to-right order.
- **Skill positions (5):** X, F, Y, Z, H — circles.
- **QB (1):** Q — circle, distinct color.

Default coordinates approximate the reference screenshot: X and Y flank the line just outside the tackles, F and Z sit off the line a few yards back on each side, H sits directly behind the QB, Q sits centered a few yards back. All 11 are draggable afterward like today's tokens. There is no "delete" in this phase — the 11 tokens are permanent for a new formation; you reposition rather than remove them. (Legacy formations already in the database, which don't have exactly this set, are unaffected — see "Existing formations" below.)

The QB/Skill/Lineman "arm a role then click to place" flow is removed for new formations, since there's nothing left to add.

## Selecting a token: Color & Label panel

Clicking a token selects it — same white selection-ring behavior as today — and opens a panel (matching the reference screenshot):

- A text input showing the token's current label, editable (rename X to anything).
- A color palette (~16 swatches in two rows) to set the token's stroke/fill color.
- A row of ~8 fill-style variants (solid fill, several half-fill orientations, outline-only, etc.) to set how the token renders.

Exact palette hex values and the precise semantics of each fill-style icon should be sampled from the reference screenshot (and the previously-cloned Playmaker recon in `clone-workspace/playmaker-editor/` if useful) during implementation — the design intent is a faithful clone, but pixel-exact values weren't available at spec time. Defaults for freshly-placed tokens: teal outline for skill positions and lineman (matching current app convention), red/maroon outline for QB — i.e. today's look, until the coach customizes.

**Data model:** the player-token type gains two fields, `color: string` and `fillStyle: FillStyleVariant` (an 8-value union). This is added to the shared token type used by both `Formation.players` and `Play.players`, so a play's tokens inherit a formation's styling by default and (in a later phase) can be restyled per-play too.

## Editing an existing formation

Clicking a formation tile in `FormationsGallery` now opens `FormationEditorView` pre-populated with that formation's saved `name` and `players`. Saving calls an update (not create) against the existing formation row. The "+ New Formation" tile keeps today's create behavior.

**Existing formations:** formations already in the database don't necessarily have exactly the new 11-token set (they may have generic S1/S2-style labels, no `color`/`fillStyle`, or a different count). They still load and remain fully editable — reposition, rename via the same panel, recolor — with sensible fallback rendering for tokens missing `color`/`fillStyle` (same defaults as freshly-placed tokens). No migration or forced restructuring of legacy data.

## Mirror

A new "Mirror" button (next to Save) appears once a formation has been saved at least once (i.e. it's disabled/hidden while creating a brand-new, not-yet-saved formation — save first, then mirror). Clicking it:

1. Prompts for a name for the new formation (e.g. pre-filled as "\<current name\> (Mirrored)", editable).
2. Computes a mirrored player set: every token's x-coordinate flips horizontally (`x' = FIELD_WIDTH - x`); y is unchanged.
3. Creates and saves this as a **new** formation under the given name. The formation currently open is untouched.

**Labeling rule — this is the one place skill and lineman tokens behave differently:**
- **Skill/QB tokens** keep their own label attached to the same token through the flip (an "X" that moves to the mirrored spot is still called "X"). This matches how the coach wants to freely rename/recolor without the mirror second-guessing it.
- **Lineman tokens are special-cased.** After computing the mirrored x-coordinates for all 5 linemen, they are **relabeled by their resulting left-to-right sorted order** — whichever lineman token ends up leftmost is labeled LT, next LG, then C, then RG, then RT — regardless of which physical token (or which label it had before) ended up there. This guarantees the line always reads LT, LG, C, RG, RT left to right after a mirror, even if the coach had previously dragged individual linemen out of their default order.

## Shared field background

`FormationCanvas.tsx` currently duplicates a `YARD_LINES` constant (also duplicated in the play editor's `FieldCanvas.tsx`) drawing evenly-spaced unlabeled lines edge-to-edge. This phase replaces it with a shared field-background piece (new component, e.g. `FieldBackground.tsx`, or a shared render function) used by `FormationCanvas`:

- Keeps the existing `viewBox="0 0 100 60"` convention with the line of scrimmage at `y=30`.
- Draws three lines above and three below the LOS at `y = 30 ± 10` (5 yd), `30 ± 20` (10 yd), and `30 ± 30` (15 yd, i.e. the very top/bottom edges of the viewBox) — the 15-yard lines sit exactly on the field's edge.
- Labels each line with its yard number ("5", "10", "15") near both the left and right edges of the field, matching the reference screenshot.
- The line of scrimmage itself stays visually heavier than the yard lines (as today).

This component is written to be reused as-is by the play editor's `FieldCanvas` in Phase 2 — Phase 1 only wires it into `FormationCanvas`.

## Non-goals for this phase

- No route drawing, route styling, or annotations (Phase 2/3).
- No changes to the play editor's toolbar (Phase 3).
- No token deletion/re-addition for the 11 default tokens (explicitly decided against — positions are fixed, move-only).
- No automated migration of existing formations to the new token set or fields.

## Testing

- Unit tests for the mirror math (x-flip correctness, lineman relabel-by-sorted-order, skill-label-preservation) and for the create-vs-update save path.
- Manual verification in-browser: create a new formation (confirm all 11 defaults appear correctly labeled/positioned), recolor/restyle/rename a token via the panel, edit and save an existing (legacy) formation, mirror a formation with manually-dragged linemen and confirm the LT..RT relabeling, confirm the field background renders and labels correctly.
