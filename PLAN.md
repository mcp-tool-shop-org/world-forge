# Design Notes — World Forge

> Architectural decisions and conventions for the editor.

## Architecture decisions

**Preset types live in `packages/editor/src/presets/`** — not in schema. Presets are editor tooling, not project data. When applied, they write normal schema types (District, EncounterAnchor, FactionPresence, PressureHotspot). No preset metadata survives into export.

**Preset store mirrors template-store** — Zustand + localStorage. Built-in presets are immutable, user presets are full CRUD.

**Hotkeys extracted to `hotkeys.ts`** — centralized dispatch table. Input-safe guard preserved (skip when target is INPUT/TEXTAREA/SELECT).

**Double-click uses existing `findHitAt`** — hit-testing already returns typed results. Double-click dispatches to the correct panel by switching rightTab + selecting the object.

**Design system** — `theme.css` (CSS custom properties) is the single source of truth. `styles.ts` provides CSSProperties objects for use with `style={}` props. `ModalFrame.tsx` is the standard modal shell (all 7 modals migrated). `shared.tsx` contains only reusable components (PanelHeader, ConfirmButton, EmptyState, useFocusHighlight) — no style constants.

---

## Shipped (v1.0 → v4.2.0)

**v4.2.0 — UE5 alignment wave (2026-04-22).** Added `@world-forge/export-unreal` as a peer lane to `export-ai-rpg`. Schema gained 2.5D fields on `Zone` (`elevation`, `elevationRange`, `parallaxLayers`, `skylineRef`) with matching validation + advisories. Reserved `@world-forge/export-godot` stub for the planned Fractured Road lane. Introduced `CanonAdapter` interface stub (no implementation). Editor Export modal exposes a new "Export Unreal Engine 5" button. 1692 tests total (1660 → 1692).

All prior releases shipped. See CHANGELOG.md for full history.

Highlights:
- Schema + validation (54 checks) + advisory validation (mode-specific)
- Full authoring surface (zones, connections, districts, entities, items, dialogues, player, builds, trees, assets, packs, encounters, factions)
- Canvas viewport with pan/zoom/fit, selection, multi-edit, snapping, resize handles
- 7 authoring modes (dungeon, district, world, ocean, space, interior, wilderness)
- Speed Panel (command palette with macros, favorites, groups)
- Starter kits with export/import (.wfkit.json)
- Project bundles (.wfproject.json) with provenance
- Dependency scanner with inline repair
- Review mode with health classification
- Export to ai-rpg-engine ContentPack (zero engine gaps)
- Design system token layer (theme.css + styles.ts + ModalFrame)
- 7-page Starlight handbook

## Possible future work

These are ideas, not commitments. No timeline or priority implied.

### Spatial / Canvas
- Tilemap painting brush tool (renderer-2d has tileset support, no brush yet)
- Layer system (foreground/background/overlay per zone)
- Connection waypoint dragging (custom path routing)
- Zone templates / stamps (pre-built room layouts)

### Content Authoring
- Visual dialogue editor (node-graph view for branching trees)
- AI-assisted content generation (Ollama-powered entity/dialogue/encounter suggestions)
- Loot table editor (drop probabilities, rarity curves, treasure hoards)
- Quest/objective system (chain encounters + dialogues into quest arcs)

### Workflow / DX
- Live preview (run ai-rpg-engine in side panel)
- Undo history browser (visual undo stack)
- Plugin system (custom panel slots, user scripts)
- Minimap click-to-navigate

### Export / Integration
- Multiple export targets (Foundry VTT, Roll20, generic JSON-LD)
- Partial export (single district or zone cluster)
- Hot reload (watch mode re-export on save)

### Quality of Life
- Light mode theme option
- Accessibility (keyboard-only canvas navigation, screen reader labels)
