# World-Modeling — Polish Backlog (deferred)

> The world-modeling layer (vertical strata, typed hazards, zone entry party-gates)
> shipped end-to-end in v4.5.0 — schema → editor → Godot 4 export, all engine-verified.
> Nothing here is required; the authoring→Godot loop is closed for every shipped
> layer. This is the optional follow-on list, captured so it can be picked up cold.
> Design rationale + research grounding: [`world-modeling-design.md`](./world-modeling-design.md).
>
> Effort is sized relative (small / medium / larger), not in calendar days.

## Editor polish — small

### 1. `visibleStrata` editor UI
A stratum's `visibleStrata` (which other layers are visible from it — the
cell-and-portal / PVS field) is fully supported in the schema, validation
(rule 69), and the Godot export (`metadata/visible_strata`), but the editor
panel doesn't expose it yet. Add a multi-checkbox over the *other* strata.
- Where: `packages/editor/src/panels/StrataPanel.tsx`
- Store: already has `updateStratum`; no new CRUD needed.

### 2. Hazard editor — advanced fields
`HazardLibraryPanel` edits the effects union + `trigger` / `passable` /
`moveCostDelta` / `blocksVision`, but defers a few fields that the schema,
validation, and Godot export already support:
- hazard-level: `weatherConditions`, `immuneTags`, `tags`
- per-effect: `amountIsPercentMaxHp` (damage), `durationTicks` (damage)
- Where: `packages/editor/src/panels/HazardLibraryPanel.tsx`

## Editor + canvas — medium

### 3. Building place-tool + footprint rendering
Buildings are authored via numeric footprint inputs in the Town Structures panel,
but there's no canvas place-tool and footprints aren't drawn. Add a
`'building-place'` `EditorTool` + a small palette (pick `buildingType`), place on
drag (footprint rect, mirroring the `zone-paint` pattern), and render building
footprints as labeled rects in the canvas draw loop.
- Where: `packages/editor/src/store/editor-store.ts` (`EditorTool` union + `setTool`),
  `packages/editor/src/panels/Canvas.tsx` (draw + mouse handlers),
  `packages/editor/src/panels/TownStructuresPanel.tsx` (already has the data).
- Store CRUD (`addBuilding`/`updateBuilding`) already exists.

## Export fidelity — medium

### 4. Parallax → Godot `ParallaxBackground`
Parallax layers currently export as `approximated` — no node is emitted (the
fidelity was honestly demoted in B-1.5 because the old report claimed a
`ParallaxBackground` node that didn't exist). Emit real `ParallaxBackground` +
`ParallaxLayer` nodes in the Godot scene and promote the fidelity to `lossless`
(textureless or asset-bound).
- Where: `packages/export-godot/src/scene-builder.ts` (+ a `convert-parallax.ts`
  mirroring the other converters), and update `fidelity` for the `navigation`/
  visual domain.

## Schema / new layers — larger (study-swarm candidates)

### 5. Per-tile combat height + jumpTolerance
The FFT/Tactics-Ogre **fine** elevation: a per-tile integer `height` plus a unit
`jumpTolerance`, where reachability and combat bonuses are derived from the height
*delta* (not absolute z). This was deliberately split out of `Stratum` (the macro
vertical layer) in the v4.5.0 design — it belongs on `TileDefinition` / tile
placements and is combat-system-adjacent. Strong candidate for a research-grounded
design pass before building.
- Where: `packages/schema/src/visual.ts` (TileDefinition), plus Godot export of the
  per-tile height into `tile_map_data` custom data layers.

### 6. First-class `WallEdge` / `InteriorLayout`
Free-form (non-grid) edge walls + authored door positions. Today wall collision is
grid-tile-based (non-walkable tiles → per-cell `StaticBody2D`) and door positions
are edge-midpoint approximations on zone connections. Only needed if non-grid
interior layouts are wanted; grid-based interiors are fully covered.
- Where: new `packages/schema/src/interior.ts` (or extend `spatial.ts`), a new
  Godot converter, editor wall-draw tool.

## Explicitly OUT of scope for world-forge (engine concern — do NOT build here)

- **Runtime dynamic hazard tile-state** — e.g. Triangle Strategy's water→conducts-
  lightning or fire-spread chaining. This is engine *simulation* driven from the
  exported hazard metadata, not authoring data. world-forge ships the static
  `HazardDefinition`; the game runtime evolves dynamic tile state at play time.
  (Listed here only to keep it from being mistaken for a world-forge backlog item.)
