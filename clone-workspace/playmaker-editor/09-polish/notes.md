# Polish pass — playmaker-editor clone

- Filled in full player layouts for 3-4 and Nickel defensive formations, and all 6 special-teams formations (previously empty stubs) using a `spreadRow` helper for consistent line placement.
- Added per-unit "Uncategorized" categories for defense and special teams (previously offense-only).
- Wired the Annotations panel to a real click-to-arm / click-to-place flow (arrow, football, cone, comment), consistent with the already-confirmed click-to-place-waypoint pattern used for routes. Added real SVG glyphs for each annotation kind on the field (previously just a placeholder dot).
- QA spot-check via computed styles on the running dev build against `assertions.json`: body background/color/font-family/font-size and button border-radius all matched exactly. Found and fixed one deviation — `RouteToolBar` and `AnnotationsPanel` were using the panel tone (`#1F272E`) instead of the toolbar tone (`#3A434D`) for their slide-up backgrounds; corrected to match the reference's lighter bottom-bar strips.
- Re-verified in browser after fixes: defense formation (4-3) renders correctly, football annotation places on click with live hint text, no console errors.

## Known remaining gaps (acceptable for a design-reference clone, not pursued further)
- Defense/special-teams player coordinates are reasonable approximations, not measured from the real app (offense was the only unit directly tested for exact positions).
- No persistence (in-memory React state only) — matches the fact this is a design/behavior reference, not the final app's data layer.
- Route curve rendering uses a simple quadratic approximation; the real app's exact curve math wasn't extracted.
