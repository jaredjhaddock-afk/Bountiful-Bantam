# List Management & Play Numbering — Design Spec

Sequencing note: this is the first of four follow-up phases agreed with the coach, in this order: **(1) this phase**, (2) play editor field redesign + route-drawing engine, (3) play editor toolbar fixes + annotations, (4) print modes (wrist-coach card + full playbook). Print depends on play numbering existing, hence the order.

## Goals

Formations and plays currently have no way to be deleted or reordered — they render in whatever order Supabase returns them (creation order), permanently. This phase adds delete and drag-to-reorder for both, and gives every play a persistent, coach-editable number (currently `PlayCard` shows a fake "number" that's really just the card's position in the visible, filtered grid — it shifts constantly and isn't stored anywhere).

## Delete

**Plays:** clicking a play's delete icon shows a confirmation ("Delete '\<name\>'? This can't be undone." / Cancel / Delete). No blocking conditions — nothing else references a play.

**Formations:** clicking a formation's delete icon first checks whether any play in that unit references it (`play.formationId === formation.id`). If any do, deletion is blocked: show a message naming the specific plays that use it ("Can't delete — used by: Trips Slant, Four Verts") with no delete option, so the coach reassigns or deletes those plays first. If no plays reference it, show the same confirmation flow as plays.

**Categories** are out of scope for this phase (not requested) — no delete/reorder added for them.

## Reorder

Drag-and-drop directly in the existing card grids (`FormationsGallery`, the play grid in `PlaybookListView`), via a small grip handle in each card's top-left corner (matching the approved mockup) — the whole card isn't the drag target, since cards are already click-to-open. Dragging live-reflows the grid (siblings shift to make room) and commits the new order on drop.

**Scope:** one global order per unit (offense/defense/specialTeams) — not per category/formation filter view. Filtering just hides non-matching cards; the ones shown keep their relative order from the unit's full ordering.

**New items** (a newly created formation or play) are always appended at the end of their unit's order — no extra placement decision needed; drag it up afterward if desired.

**Approach:** add `@dnd-kit/core` + `@dnd-kit/sortable` as a new dependency rather than hand-rolling grid drag-and-drop. The existing hand-rolled drag code in this app (`FormationCanvas`) is a single-element-on-a-canvas drag, which is a much simpler problem than reordering N sibling cards in a wrapping grid with live reflow and touch support — `dnd-kit` is small, actively maintained, and handles the cross-browser/touch edge cases that would otherwise be a significant source of bugs. Recommended over hand-rolling given the complexity gap; reasonable to revisit only if a strong reason to avoid new dependencies comes up later.

**Persistence:** on drop, recompute the full ordered list of ids for that unit and write a fresh integer `sortOrder` (0, 1, 2, ...) to every item in it. Simpler and safer than fractional/gap-based positioning (no float-precision or gap-exhaustion edge cases to get wrong) — for the realistic scale of a team's playbook (tens of items per unit), rewriting the whole unit's order on each drag is cheap and keeps the mental model simple.

## Play numbering

Every play gets a persistent, integer `number` field:

- **New plays:** auto-assigned to one more than the current highest number in that unit (starting at 1 if the unit has no plays yet). Numbering is **per unit** — offense, defense, and special-teams plays are numbered independently, each starting at 1 — matching how a wrist coach is typically built per unit/role, and matching how the rest of the app is already organized by unit.
- **Editable:** the coach can edit any play's number directly (e.g. to build a real playbook convention like "10s = runs, 20s = passes"), the same rename-style interaction already established for formation tokens' Color & Label panel in the prior phase.
- **Uniqueness:** editing a play's number to match another play's number *in the same unit* is rejected with an inline error (same duplicate-rejection pattern already built for formation token labels) — a wrist coach with two plays both labeled "12" defeats the whole point of numbering.
- **Deleting a play never renumbers the others** — numbers only change when a coach explicitly edits them. Gaps left by deletion are expected and fine (matches real playbook practice — players memorize numbers, so a deleted play's number shouldn't get silently reassigned to something else mid-season).
- `PlayCard`'s current fake "position index" badge is replaced by this real, persistent number.

## Data model changes

`Formation` and `Play` (in `types/play.ts`) each gain a `sortOrder: number` field. `Play` additionally gains a `number: number` field.

New Supabase migration adds `sort_order integer not null default 0` to both `formations` and `plays`, and `number integer not null default 0` to `plays`. Existing rows are backfilled in the same migration: `sort_order` set by each row's existing `created_at` order (within its team+unit), and `plays.number` similarly backfilled 1, 2, 3... by `created_at` order within each team+unit — so nothing visually jumps around immediately after the migration runs, and every existing play ends up with a real, edit-able number instead of none.

## Non-goals for this phase

- No delete/reorder for categories.
- No print output (a later phase, which will read the `number` field this phase adds).
- No changes to route drawing, the field canvas redesign, or the play editor toolbar (later phases).

## Testing

- Unit tests for: the "next number" assignment logic (per-unit, highest+1), the duplicate-number rejection check, and the sort-order recomputation function (given a dragged-item id and its new index, produces the correct full reordered list).
- Manual verification: create/delete a play and a formation (including the blocked-delete case for a formation with dependent plays), drag-reorder both grids and confirm the order persists across reload, edit a play's number (including hitting the duplicate-rejection case), confirm new plays/formations auto-append at the end.
