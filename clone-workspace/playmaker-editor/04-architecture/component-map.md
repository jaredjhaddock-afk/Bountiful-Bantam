# Component Map — Playmaker-style Play Editor clone

## Tree

```
<App>                                    view: 'list' | 'editor' | 'templates'
├─ <AppShell>                            back button, title, help + cloud-sync icons
│
├─ view=list: <PlaybookListView unit>
│   ├─ <UnitTabs>                        ○ Offense · ✕ Defense · ◇ Special Teams
│   ├─ <FilterTabs>                      Formations | Categories
│   ├─ <FormationList>                   click a formation/category to filter <PlayGrid>
│   │   └─ "Edit Formations" / "Edit Categories" → view=templates
│   └─ <PlayGrid>
│       ├─ <NewPlayTile onClick={openModal}>
│       └─ <PlayCard>* → click → view=editor
│           └─ <PlayThumbnail>           read-only mini <FieldCanvas>
│
├─ <NewPlayModal open>                   overlays list view
│   ├─ name input
│   ├─ <FormationPicker>
│   ├─ <CategoryPicker>
│   ├─ <PositionNotesList>               one row per formation position
│   └─ confirm → creates Play, view=editor
│
├─ view=editor: <PlayEditorView playId>
│   ├─ <EditorToolbar>
│   │   ├─ info · lock/unlock · motion(film) · notes(brackets)
│   │   ├─ route-tool toggle            → opens <AnnotationsPanel>
│   │   ├─ personnel(huddle)
│   │   └─ preview/play
│   ├─ <FieldCanvas>                     SVG, yard-ruled, LOS line
│   │   ├─ <PlayerToken>* (11 offense | 11 defense | ST unit)
│   │   │   onClick → select (white 2px ring) → opens <RouteToolBar>
│   │   ├─ <RoutePath>*                  one polyline/curve per player with a drawn route
│   │   └─ <Annotation>*                 arrow/football/cone/comment instances dropped on field
│   ├─ <AnnotationsPanel open>           slide-down under toolbar: drag-onto-field icons
│   └─ <RouteToolBar selectedPlayer>     slide-up: style icons (straight/curve/motion/star) · delete · confirm
│
└─ view=templates: <TemplatesView>
    ├─ tab: <FormationsGallery>          formation preset cards, dot-grid mini-field preview
    └─ tab: <RouteTreeGallery>           numbered 0-9 route tree + named presets (Screen, Quick Out, …)
```

## Editor interaction state machine (the core mechanic — confirmed by direct testing, not guessed)

```
IDLE
  → click a PlayerToken            → SELECTED (token gets white ring; RouteToolBar slides up)
SELECTED
  → click a route-style icon       → STYLE_ARMED (style icon highlighted; next field click starts drawing)
  → click delete (red circle-slash)→ removes existing route → IDLE
  → click confirm (green check)    → deselect → IDLE
STYLE_ARMED
  → click a point on the field     → WAYPOINT_PLACED (line segment drawn from player to that point,
                                       styled per the armed style — straight, curve, etc. — colored to
                                       match the player's token color; arrowhead at the new endpoint)
WAYPOINT_PLACED
  → click another field point      → extends the path with another segment (repeat)
  → click confirm                  → commits the route → IDLE
  → click delete                   → clears the whole draft path → SELECTED
```

Note: dragging directly from the player (press-and-drag in one gesture) does **not** draw a route — confirmed by direct test. Only discrete clicks place waypoints. This matters for our own implementation: don't build a drag-to-draw interaction here, build click-to-place.

## Shared data model sketch (`types/play.ts`)

```ts
type Unit = 'offense' | 'defense' | 'specialTeams';
type PlayerRole = 'qb' | 'skill' | 'lineman' | 'defense' | 'specialTeams';

interface PlayerToken {
  id: string;
  label: string;        // "X", "LT", "F", ...
  role: PlayerRole;
  x: number; y: number;  // field-relative coords (see svgFieldMath)
  route?: RoutePoint[];   // ordered waypoints, empty if no route drawn
  routeStyle?: 'straight' | 'curve' | 'motion' | 'star';
}
interface RoutePoint { x: number; y: number; }
interface Annotation { id: string; kind: 'arrow' | 'football' | 'cone' | 'comment'; x: number; y: number; text?: string; }
interface Formation { id: string; name: string; unit: Unit; players: Omit<PlayerToken,'route'|'routeStyle'>[]; }
interface Play {
  id: string; name: string; unit: Unit;
  formationId: string; category: 'run' | 'pass' | 'uncategorized' | string;
  players: PlayerToken[]; annotations: Annotation[]; positionNotes: Record<string,string>;
}
```

This mirrors what recon actually observed (formation-driven starting positions, per-player routes, per-position notes, unit-scoped categories) rather than inventing fields we didn't see evidence for.
