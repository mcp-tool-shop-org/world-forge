# Design Notes — World Forge

> Architectural decisions and conventions for the editor.

## Architecture decisions

**Preset types live in `packages/editor/src/presets/`** — not in schema. Presets are editor tooling, not project data. When applied, they write normal schema types (District, EncounterAnchor, FactionPresence, PressureHotspot). No preset metadata survives into export.

**Preset store mirrors template-store** — Zustand + localStorage. Built-in presets are immutable, user presets are full CRUD.

**Hotkeys extracted to `hotkeys.ts`** — centralized dispatch table. Input-safe guard preserved (skip when target is INPUT/TEXTAREA/SELECT).

**Double-click uses existing `findHitAt`** — hit-testing already returns typed results. Double-click dispatches to the correct panel by switching rightTab + selecting the object.

**Design system** — `theme.css` (CSS custom properties) is the single source of truth. `styles.ts` provides CSSProperties objects for use with `style={}` props. `ModalFrame.tsx` is the standard modal shell (all 7 modals migrated). `shared.tsx` contains only reusable components (PanelHeader, ConfirmButton, EmptyState, useFocusHighlight) — no style constants.

---

## Shipped (v1.0 → v4.3.0)

**v4.3.0 — 2.5D-focused feature wave (2026-04-23).** Dogfood-swarm release shipping the 2.5D surface end-to-end. Schema gained `LootTable`, `SpawnCondition` grammar, `TransitionEntity`, Zone physics/sky/collision fields. Editor shipped the full Zone 2.5D authoring UI, canvas elevation badges, parallax preview, multi-zone batch ops. Renderer shipped 2.5D visualization + `DiagnosticsOverlay`. `export-unreal` gained sky/lighting metadata, collision channels, `actors/parallax-manifest.json`, gravity/transition passthrough. `export-ai-rpg` gained debug/release profiles + `--dry-run`. Before the feature pass, the swarm closed 110 health-pass items (56 Stage A + 54 Stage B/C) across three commits. 1959 tests (1692 → 1959, +267).

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

---

## v4.4 Roadmap (deferred from v4.3.0 swarm)

The v4.3.0 dogfood swarm audited 51 features and approved a 2.5D-focused wave of 15. The remaining 36 features + 3 large-effort deferrals are parked here. Priorities are the auditor's — re-triage before picking up.

### Gates to decide at v4.4 kickoff

| Decision | Trigger | Impact |
|---|---|---|
| **Godot exporter scope** | Fractured Road timing | Blocks whenever Mike starts production Godot authoring. Stubs in `packages/export-godot/` are inert; no work begins until decided. `export-unreal` is the reference shape to mirror. |
| **Canon adapter v1** | When Mike wants starter-kit browsing in the editor | SCH-FT-007. Concrete implementation outside schema (editor package, wired to `style-dataset-lab/projects/<game>/canon/` + `motif/packages/<game>/`). |
| **Quest system scope** | When a dogfooded game surfaces concrete requirements | SCH-FT-002. Today's dialogue trees are flat. Design cost is real; don't over-build ahead of a game's actual need. |
| **UE5 reference loader timing** | When Star Freight UE5 is ready to consume the pack | UE-FT-001. Lives in `F:/AI/star-freight-ue5/`, NOT in this repo. world-forge ships the contract; loader lives with the game. |

### HIGH-priority deferred (most value per effort)

| ID | Package | Feature | Effort |
|---|---|---|---|
| SCH-FT-005 | schema | Faction relationship matrix (allied/hostile/neutral over time) | Small |
| AIR-FT-002 | export-ai-rpg | Streaming JSON writer for large projects (1000+ zones) | Large |
| ED-FT-002 | editor | Tilemap painting brush tool (renderer-2d has tileset support already) | Medium |
| INF-FT-007 | site/infra | Handbook walkthroughs for Fractured Road + Star Freight + "Elevation in 2.5D" | Medium |
| SCH-FT-002 | schema | Quest + objective system (QuestDefinition, ObjectiveNode, QuestChain, QuestMarker) | Medium-Large |

### MEDIUM deferred — quality of life

| ID | Package | Feature | Effort |
|---|---|---|---|
| SCH-FT-007 | schema+editor | CanonAdapter v1 implementation (reads canon trees, wires to starter-kit browser) | Large |
| SCH-FT-008 | schema | Custom AuthoringMode extensibility (allow game-specific mode definitions) | Small |
| SCH-FT-009 | schema | Zone camera rig hints (angle, distance) — lighting half shipped in v4.3.0 | Small |
| SCH-FT-010 | schema | Non-rectangular zone geometry (polygons, circles for Star Freight curved modules) | Large |
| SCH-FT-011 | schema | Soft-deprecation hints on schema fields for v5 migration | Small |
| AIR-FT-003 | export-ai-rpg | `--filter-zones` / `--filter-districts` for partial exports | Medium |
| AIR-FT-004 | export-ai-rpg | `--copy-assets` / `--validate-assets` (physically copy referenced files) | Medium |
| AIR-FT-006 | export-ai-rpg | Best-effort / lenient export mode (export what's valid, report what isn't) | Medium |
| AIR-FT-007 | export-ai-rpg | Backwards-compat format exporting (target older ai-rpg-engine versions) | Large |
| UE-FT-005 | export-unreal | CLI `--summary`, `--diff <prev> <new>` for change review | Small |
| UE-FT-006 | export-unreal | Instanced mesh hints for UE5 HISM (50+ tiles per zone) | Medium |
| UE-FT-007 | export-unreal | Pack signing / integrity hash in pack.json | Small |
| UE-FT-008 | export-unreal | Schema versioning + migration framework (FormatVersion today is hardcoded '1.0.0') | Medium |
| ED-FT-006 | editor | Speed Panel 2.5D quick actions (pinnable elevation/parallax commands) | Small |
| ED-FT-007 | editor | Undo history browser (visual undo stack) | Large |
| ED-FT-008 | editor | Minimap click-to-navigate (today: pan-on-click works, select-on-click doesn't) | Medium |
| ED-FT-009 | editor | Live Preview pane (iframe ai-rpg-engine / UE5 WebGL in a side tab) | Large |
| ED-FT-010 | editor | AI-assisted content via Ollama (entity/dialogue/encounter suggestions) | Large |
| INF-FT-004 | renderer-2d | Minimap interactivity (click-to-select zones, drag viewport frame) | Small |
| INF-FT-005 | renderer-2d | Parallax preview sub-renderer (separate from editor-side preview shipped in v4.3.0) | Medium |
| INF-FT-006 | renderer-2d | Skyline on-canvas silhouette line + asset dropdown field validation | Small |
| INF-FT-008 | infra | SECURITY.md Development + CI section (clarify Codecov upload is the one exception) | Small |
| INF-FT-009 | infra | Accessibility handbook page + a11y-audit.md roadmap | Medium |
| INF-FT-010 | dogfood | 1-2 additional dogfood examples (SpacePort-Cargo, Wilderness-Trail) | Small |

### LOW deferred — polish

| ID | Package | Feature |
|---|---|---|
| AIR-FT-008 | export-ai-rpg | Watch mode (re-export on project file change) |
| UE-FT-009 | export-unreal | Watch mode (same, for UE5 lane) |
| UE-FT-010 | export-unreal | Binary output (`.uasset` / `.pak` instead of JSON) — only if JSON proves slow |
| ED-FT-011 | editor | Keyboard-only workflow completeness audit |
| ED-FT-012 | editor | Theme customization (accent color picker, font size slider) |

### Not on roadmap — older "possible future work"

Kept here for reference; re-triage if any become real needs:

- Layer system (foreground/background/overlay per zone)
- Connection waypoint dragging (custom path routing)
- Zone templates / stamps (pre-built room layouts)
- Visual dialogue node-graph editor (today: text-form)
- Plugin system (custom panel slots, user scripts)
- Additional export targets (Foundry VTT, Roll20, generic JSON-LD)
- Hot reload (distinct from watch mode)
- Light mode theme refinement (toggle exists)

### Swarm entry points if picking this up

- **Swarm the remaining HIGH items** — a 10-phase dogfood pointed at the 5 HIGH deferrals above ships a clean v4.4.0. Protocol: `F:\AI\dogfood-labs\swarms\PROTOCOL.md`. Save-point tag from v4.3.0: `swarm-save-1776912469`.
- **Feature-specific sessions** — e.g. "implement SCH-FT-002 Quest system end-to-end" — a single agent scoped to schema + exporters + editor for one feature. Cheaper than a full swarm for one feature.
- **Strategic gate first** — don't start Godot exporter without Fractured Road signal; don't start Quest system without a dogfooded game asking for it.
