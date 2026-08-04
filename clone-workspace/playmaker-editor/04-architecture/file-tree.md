# Architecture — Playmaker-style Play Editor clone

**Stack:** React + TypeScript + Vite + Tailwind CSS (chosen for output — see `00-config.json`; the live source's own framework was not fingerprinted, this is a from-scratch rebuild guided by `DESIGN.md`).

**Why this structure:** the real app is not a multi-page site — it's a single-page tool with client-side view switching (playbook list ↔ new-play modal ↔ editor canvas ↔ templates gallery) and three parallel "units" (Offense/Defense/Special Teams) that share the same components with different data. The file tree mirrors that: one `PlaybookApp` shell, view components per screen, and a shared `editor/` module for the field-canvas engine since that's the most complex, most reused piece (same canvas renders offense, defense, and special-teams plays).

```
clones/playmaker-editor/
├── package.json
├── tailwind.config.ts          # colors/radii/spacing/fonts sourced from DESIGN.md tokens
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # top-level view switch: list | editor | templates
│   ├── styles/
│   │   └── globals.css          # font-face imports (Barlow Condensed, Montserrat), CSS reset
│   ├── types/
│   │   └── play.ts              # Play, PlayerToken, RoutePoint, Formation, Category, Unit ('offense'|'defense'|'specialTeams')
│   ├── state/
│   │   ├── playbookStore.ts     # formations/categories/plays per unit, CRUD
│   │   └── editorStore.ts       # selected player, active route-draw mode, draft waypoints, annotations
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx     # dark theme root, top bar (back/title/help/cloud icons)
│   │   ├── playbook/
│   │   │   ├── PlaybookListView.tsx
│   │   │   ├── UnitTabs.tsx         # circle/X/diamond icon tabs = Offense/Defense/Special Teams
│   │   │   ├── FilterTabs.tsx       # Formations / Categories sub-tabs
│   │   │   ├── FormationList.tsx    # left sidebar list with play-count badges
│   │   │   ├── PlayGrid.tsx
│   │   │   ├── PlayCard.tsx         # play thumbnail (mini FieldCanvas render, read-only)
│   │   │   ├── NewPlayTile.tsx
│   │   │   └── NewPlayModal.tsx     # name, formation picker, category picker, position notes
│   │   ├── editor/
│   │   │   ├── PlayEditorView.tsx
│   │   │   ├── EditorToolbar.tsx    # info/lock/motion/notes/route-tool/personnel/preview icons
│   │   │   ├── FieldCanvas.tsx      # SVG field: yard lines + LOS + renders PlayerToken/RoutePath/Annotation children
│   │   │   ├── PlayerToken.tsx      # circular token, variant: qb | skill | lineman, color from DESIGN.md
│   │   │   ├── RoutePath.tsx        # click-to-place-waypoint polyline/curve, colored to match its player
│   │   │   ├── AnnotationsPanel.tsx # drag-onto-field: arrow, football, cone, comment
│   │   │   └── RouteToolBar.tsx     # bottom slide-up on player select: style + delete + confirm
│   │   └── templates/
│   │       ├── TemplatesView.tsx
│   │       ├── FormationsGallery.tsx
│   │       └── RouteTreeGallery.tsx # numbered 0-9 route tree + named presets (Screen, Quick Out, ...)
│   └── lib/
│       └── svgFieldMath.ts      # yard-line ↔ pixel conversion, snap-to-grid helpers
```

## Build order

1. **Foundation** — `tailwind.config.ts` (DESIGN.md tokens: colors, 3px/50% radii, 5px spacing rhythm, Barlow Condensed), `globals.css` (font-face, reset), `AppShell`.
2. **Shared primitives** — `PlayerToken`, icon buttons (toolbar icon style: dark ghost buttons, 7%-white hover).
3. **Playbook list** — `UnitTabs`, `FilterTabs`, `FormationList`, `PlayGrid`, `PlayCard`, `NewPlayTile`.
4. **New play flow** — `NewPlayModal`.
5. **Editor (the core deliverable)** — `FieldCanvas` + `svgFieldMath`, `EditorToolbar`, `RoutePath` (click-to-waypoint interaction), `RouteToolBar`, `AnnotationsPanel`.
6. **Templates** — `FormationsGallery`, `RouteTreeGallery`.

`editorStore` (route-drawing interaction state) is the highest-risk piece to get right — see `component-map.md` for its state machine.
