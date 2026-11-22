# World Forge Truth-Reconciliation Audit

**Baseline:** `70d4403` (`SCHEMA_VERSION = '4.9.1'`, `packages/schema/src/validate.ts:73`)  
**Scope:** Code inventory, documentation diff (`README.md` and `site/src/content/docs/handbook/*.md`), and headless validation/export-lane audit across built-in samples, starter kits, templates, and presets. Audit report only — no behavioral or content changes are included here.

---

## 1. Code Inventory

### 1.1 Side-Panel Tabs, Panels, Conditional Inspectors, Modals, and Overlays

- **Right-sidebar `RightTab` union (`packages/editor/src/store/editor-store.ts:41`):** 14 tab identifiers (`'map' | 'player' | 'builds' | 'trees' | 'dialogue' | 'assets' | 'issues' | 'deps' | 'review' | 'guide' | 'import-summary' | 'diff' | 'objects' | 'presets'`), ordered in `App.tsx:171-184` as:
  1. `map` (`Map`) — `packages/editor/src/App.tsx:171`
  2. `player` (`Player`, `<PlayerTemplatePanel />`) — `App.tsx:172,693`, `panels/PlayerTemplatePanel.tsx:15`
  3. `builds` (`Builds`, `<BuildCatalogPanel />` with 6 `BuildsSubTab`s: `config`, `archetypes`, `backgrounds`, `traits`, `disciplines`, `combos`) — `App.tsx:173,694`, `editor-store.ts:42`, `panels/BuildCatalogPanel.tsx:28`
  4. `trees` (`Trees`, `<ProgressionPanel />`) — `App.tsx:174,695`, `panels/ProgressionPanel.tsx:20`
  5. `dialogue` (`Dialogue`, `<DialoguePanel />`) — `App.tsx:175,696`, `panels/DialoguePanel.tsx:26`
  6. `objects` (`Objects`, `<ObjectListPanel />`) — `App.tsx:176,697`, `panels/ObjectListPanel.tsx:30`
  7. `presets` (`Presets`, `<PresetBrowser />` with `region` / `encounter` sub-tabs) — `App.tsx:177,698`, `panels/PresetBrowser.tsx:19,21`
  8. `assets` (`Assets`, `<AssetPanel />`, count badge when `assets.length > 0`) — `App.tsx:178,699`, `panels/AssetPanel.tsx:21`
  9. `issues` (`Issues`, `<ValidationPanel />`) — `App.tsx:179,700`, `panels/ValidationPanel.tsx:34`
  10. `deps` (`Deps`, `<DependencyPanel />`, warning badge when `depsCount > 0`) — `App.tsx:180,701`, `panels/DependencyPanel.tsx:37`
  11. `review` (`Review`, `<ReviewPanel />`) — `App.tsx:181,702`, `panels/ReviewPanel.tsx:65`
  12. `guide` (`Guide`, `<ChecklistPanel />`, conditional on `!checklistDismissed`) — `App.tsx:182,703`, `panels/ChecklistPanel.tsx:26`
  13. `import-summary` (`Import`, `<ImportSummaryPanel />`, conditional on `Boolean(importFidelity)`) — `App.tsx:183,704`, `panels/ImportSummaryPanel.tsx:50`
  14. `diff` (`Diff`, `<DiffPanel />`, conditional on `Boolean(importSnapshot)`) — `App.tsx:184,705`, `panels/DiffPanel.tsx:22`
- **Left-sidebar panels (`packages/editor/src/App.tsx:516-519`):**
  - `<ToolPalette />` (`panels/ToolPalette.tsx:25`)
  - `<TilePalette />` (`panels/TilePalette.tsx:31`)
  - `<PropPalette />` (`panels/PropPalette.tsx:22`)
  - `<DistrictPanel />` (`panels/DistrictPanel.tsx:11`)
- **`Map`-tab conditional inspectors (`packages/editor/src/App.tsx:675-685`):**
  - Multi-selection (`getSelectionCount(selection) >= 2`): `<SelectionActionsPanel />` (`panels/SelectionActionsPanel.tsx:10`)
  - Selected connection: `<ConnectionProperties />` (`panels/ConnectionProperties.tsx:32`)
  - Single selected encounter: `<EncounterProperties />` (`panels/EncounterProperties.tsx:35`)
  - Single selected landmark: `<LandmarkProperties />` (`packages/editor/src/LandmarkProperties.tsx:9`)
  - Single selected spawn: `<SpawnProperties />` (`packages/editor/src/SpawnProperties.tsx:7`)
  - Selected zone (`selectedZoneId`): `<ZoneProperties />` (`panels/ZoneProperties.tsx:22`), `<EconomyPanel />` (`panels/EconomyPanel.tsx:23`), `<TownStructuresPanel />` (`panels/TownStructuresPanel.tsx:26`)
  - Active tool `entity-place`: `<EntityProperties />` (`panels/EntityProperties.tsx:15`)
  - World-level fallback (no single/multi selection and tool not `entity-place`): `<StrataPanel />` (`panels/StrataPanel.tsx:21`) and `<HazardLibraryPanel />` (`panels/HazardLibraryPanel.tsx:33`)
- **Nested sub-panels (mounted inside parent panels):**
  - `<ScenePreview />` inside `<ZoneProperties />` (`panels/ScenePreview.tsx:32`)
  - `<ItemProperties />` and `<TransitionProperties />` inside `<EconomyPanel />` (`panels/ItemProperties.tsx:28`, `panels/TransitionProperties.tsx:27`)
  - `<LootTablePanel />` inside `<HazardLibraryPanel />` (`panels/LootTablePanel.tsx:29`)
  - `<EditKitModal />` and `<ImportKitModal />` inside `<TemplateManager />` (`panels/TemplateManager.tsx:561-562`, `panels/EditKitModal.tsx:21`, `panels/ImportKitModal.tsx:16`)
- **Modals and canvas overlays (`packages/editor/src/store/modal-store.ts:10`, `panels/ModalLayer.tsx:18-23`, `App.tsx:529-565`):**
  - `'export'` -> `<ExportModal />` (`panels/ExportModal.tsx:110`, `ModalLayer.tsx:18`)
  - `'template-manager'` -> `<TemplateManager />` (`panels/TemplateManager.tsx:53`, `ModalLayer.tsx:19`)
  - `'import'` -> `<ImportModal />` (`panels/ImportModal.tsx:31`, `ModalLayer.tsx:20`)
  - `'save-template'` -> `<SaveTemplateModal />` (`panels/SaveTemplateModal.tsx:14`, `ModalLayer.tsx:21`)
  - `'save-kit'` -> `<SaveKitModal />` (`panels/SaveKitModal.tsx:16`, `ModalLayer.tsx:22`)
  - `showSearch` -> `<SearchOverlay />` (`panels/SearchOverlay.tsx:231`, `ModalLayer.tsx:23`)
  - `showSpeedPanel` -> `<SpeedPanel />` (`panels/SpeedPanel.tsx:32`, `App.tsx:563`)
  - First-run welcome card (`data-testid="wf-first-run-welcome"`, `App.tsx:529`), `<ToastHost />` (`App.tsx:565`), minimap (`Canvas.tsx:1959`), canvas context menu (`Canvas.tsx:1874`)
- **Orphaned / unmounted UI modules (zero UI callers outside tests/re-exports):**
  - `packages/editor/src/panels/LandmarkProperties.tsx:15` (duplicate; `App.tsx:31` mounts `src/LandmarkProperties.tsx:9`)
  - `packages/editor/src/panels/SpawnProperties.tsx:15` (duplicate; `App.tsx:32` mounts `src/SpawnProperties.tsx:7`)
  - `packages/editor/src/panels/BatchZoneActions.tsx:3` (deprecated re-export alias of `SelectionActionsPanel`)
  - `packages/editor/src/templates/layout-templates.ts:176` (`LAYOUT_TEMPLATES`: exported and re-exported in `templates/registry.ts:83`, zero UI callers)
  - `packages/editor/src/templates/dialogue-templates.ts:133` (`DIALOGUE_TEMPLATES`: zero non-test callers)
  - `batchPlaceEntities` store action (`packages/editor/src/store/project-store.ts:430,1741`): implemented in store with `'grid' | 'random' | 'circle'`, zero UI callers

### 1.2 Commands, Shortcuts, Mouse Gestures, and Context-Menu Entries

- **Top bar commands (`packages/editor/src/App.tsx:300-401`):**
  - Theme toggle (`App.tsx:300-308`), Search button (`Ctrl+K`, `App.tsx:309-317`), `New` (`openModal('template-manager')`, `App.tsx:318`), `Import` (`openModal('import')`, `App.tsx:319`), `Load` (`handleLoad`, `App.tsx:320`), `Save` (`handleSave`, `App.tsx:323`), Save dropdown menu (`Save As…`, `Save as Template`, `Save as Kit`, `App.tsx:331-381`), `Undo` (`App.tsx:386`), `Redo` (`App.tsx:394`), `Export` (`openModal('export')`, `App.tsx:401`).
  - Sidebar collapse toggles (`App.tsx:504,578`) and right-sidebar tablist (`App.tsx:595`).
- **Left-sidebar `ToolPalette` controls (`packages/editor/src/panels/ToolPalette.tsx:10-21,140-167`):**
  - **10 authoring tools (`EditorTool` in `editor-store.ts:40`, `TOOL_PALETTE_TOOLS` in `ToolPalette.tsx:10-21`):** `select` (`V`), `zone-paint` (`Z`), `connection` (`C`), `entity-place` (`E`), `landmark` (`L`), `spawn` (`S`), `tile-paint` (`T`), `prop-place` (`O`), `encounter-place` (`N`), `item-place` (`I`).
  - **Viewport buttons (`ToolPalette.tsx:140-150`):** `+` (zoom in +0.1), `-` (zoom out -0.1), `Fit` (`fitBoundsToViewport`), `Center` (`centerOnZone`), `Reset` (`resetViewport`).
  - **11 Layers + 3 editor toggles (`14` `LayerChip` controls, `ToolPalette.tsx:153-167`):** `Grid`, `Connections`, `Entities`, `Landmarks`, `Spawns`, `Backgrounds`, `Tiles`, `Props`, `Ambient`, `Minimap`, `Show Elevation`, `Snap to Objects`, `Perf Stats`, `Show renderer diagnostics`.
- **Selection Actions & Batch store commands:**
  - `SelectionActionsPanel` (`panels/SelectionActionsPanel.tsx:95-193`): `Deselect`, 6 Align (`Left`, `Center H`, `Right`, `Top`, `Center V`, `Bottom`), 2 Distribute (`Horizontal`, `Vertical`), `Assign district`, `Add tag to zones`, `Set elevation`, `Delete N zones`.
  - `mergeZones` (`store/project-store.ts:1648`) is exposed via Speed Panel / context menu (`speed-panel-actions.ts:143`); `batchPlaceEntities` (`store/project-store.ts:1741`) has no UI entry point.
- **Keyboard shortcuts (`HOTKEY_BINDINGS` in `packages/editor/src/hotkeys.ts:17-48`, `29` entries):**
  - Actions (`19` entries, `hotkeys.ts:18-36`): `Ctrl+K` (`search`), `Ctrl+S` (`save`), `Ctrl+C` (`copy`), `Ctrl+V` (`paste`), `Ctrl+D` (`duplicate`), `Ctrl+Z` (`undo`), `Ctrl+Shift+Z` (`redo`), `Ctrl+Y` (`redo`), `Ctrl+A` (`select-all`), `Delete` (`delete`), `Backspace` (`delete`), `Escape` (`escape`), `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` (nudge 1, or 5 with `Shift`), `Enter` (`open-details`), `P` (`apply-preset`), `Shift+P` (`save-preset`).
  - Tool keys (`10` entries, `hotkeys.ts:38-47`): `V`, `Z`, `C`, `E`, `L`, `S`, `T`, `O`, `N`, `I`.
  - Component-local keyboard handlers: `Space` hold-to-pan (`Canvas.tsx:1073-1077,1115`), `Escape` to close context menu (`Canvas.tsx:1083-1085`), `Shift+F10` / `ContextMenu` (`Canvas.tsx:1691-1696`), `ArrowLeft`/`ArrowRight`/`Home`/`End` on tablist (`App.tsx:597-611`), `ArrowUp`/`ArrowDown`/`Enter`/`Escape`/`Tab` in `SearchOverlay` (`panels/SearchOverlay.tsx:424-469`), `ArrowUp`/`ArrowDown`/`Enter`/`Escape` in `SpeedPanel` (`panels/SpeedPanel.tsx:123-134`), `Escape` + focus trap + `stopPropagation` in `ModalFrame` (`ui/ModalFrame.tsx:30-55`).
- **Mouse gestures (`Canvas.tsx`):**
  - Left-click / Shift-click / drag-move (`>= DRAG_THRESHOLD = 3px`, `Canvas.tsx:37,1570`) / box-select (`Canvas.tsx:932,1475`) / 8 resize handles (`Canvas.tsx:863`)
  - Middle-click, right-click drag, or `Space` + left-drag pan (`Canvas.tsx:1206-1207`)
  - Wheel cursor-anchored zoom by `ZOOM_STEP = 0.1` (`Canvas.tsx:36,1664-1688`)
  - Double-left-click to open details / center (`Canvas.tsx:1712,1866`)
  - Single right-click opens canvas context menu (delayed past `DBL_RIGHT_INTERVAL = 300ms` / `DBL_RIGHT_RADIUS = 5px`, `Canvas.tsx:49-50,1404-1424`)
  - Double-right-click (`< 300ms` within `5px`) opens `<SpeedPanel />` (`Canvas.tsx:1404-1410`)
  - Minimap click jumps viewport (`Canvas.tsx:1803`)
- **Speed Panel actions & Context Menu entries (`packages/editor/src/speed-panel-actions.ts:118-152,206-218`):**
  - **`SPEED_PANEL_ACTIONS` (`18` total):** `new-zone` (`120`), `fit-content` (`121`), `edit-props` (`124`), `delete` (`125`), `duplicate` (`126`), `assign-district` (`129`), `place-entity` (`130`), `place-encounter` (`131`), `connect-from` (`132`), `swap-direction` (`135`), `add-secret-conn` (`137`), `add-channel-conn` (`138`), `add-warp-conn` (`139`), `add-trail-conn` (`140`), `merge-zones` (`143`), `set-elevation` (`147`), `open-review` (`150`), `export-summary` (`151`).
  - **Context Menu (`getContextMenuActions` at `speed-panel-actions.ts:206-218`):** filters `SPEED_PANEL_ACTIONS` by `contextFilter(hitResult)`, puts `category === 'context'` before `'global'`, and slices to `CONTEXT_MENU_LIMIT` (`7`). Notably, there is **no `copy` and no `hide` action** in `SPEED_PANEL_ACTIONS`.

### 1.3 Validation, Advisory, Dependency, Health, and Export-Lane Checks

- **`validateProject(project)` (`packages/schema/src/validate.ts:379-2108`):**
  - Top-level array/object guards: required arrays (`WORLD_PROJECT_REQUIRED_ARRAY_FIELDS`, `validate.ts:385-392`), optional arrays if present (`WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS`, `validate.ts:399-406`), required `map` object (`validate.ts:413-422`), metadata `author`/`license`/`category`/`projectTags` type guards (`validate.ts:432-457`), closed `mode` check via `isValidMode` (`validate.ts:463-467`), optional `presentation` shape check via `validatePresentationShape` (`validate.ts:291-377,481`), positive finite `map` dimensions (`validate.ts:484-489`).
  - **Numbered structural/referential rules `1`–`89` (`validate.ts:496-2081`):**
    - `1`–`2`: At least one spawn point & default spawn (`496-501`)
    - `3`–`7`: Zone/District ID uniqueness, `parentDistrictId`, `elevation`, closed interactable types, zone neighbors symmetry, `exits` + condition grammar (`6b`), `districts.zoneIds` (`506-619`)
    - `8`–`12`: `entityPlacements` + closed `EntityRole`, `itemPlacements` + closed `ItemSlot`/`ItemRarity`, `spawnPoints`, `connections` + `VALID_CONNECTION_KINDS` (`11b`) + `SpawnCondition` (`11c`), `landmarks` + `VALID_LANDMARK_INTERACTION_TYPES` (`642-707`)
    - `13a`–`15b`: `encounterAnchors` uniqueness/zone/probability `[0,1]`/non-empty `encounterType`, `factionPresences` district/patrol refs (`14`), `pressureHotspots` uniqueness/zone (`720-791`)
    - `16`–`20`: Dialogue ID uniqueness, entry node, `nextNodeId` validity, reachability, entity `dialogueId` (`803-898`)
    - `21`–`32`: Player template spawn, starting inventory/equipment in `itemPlacements`, default archetype/background in `buildCatalog`, catalog ID uniqueness + progression/cross-title/entanglement refs (`915-1086`)
    - `33`–`36`: Progression tree & node ID uniqueness, `requires` refs, reachability (`1110-1151`)
    - `37`–`52`: Asset manifest IDs/paths/`VALID_ASSET_KINDS` (`37`–`39`), zone/entity/item/landmark refs (`40`–`45`), orphan checks (`46`, `51`), `assetPacks` uniqueness/label/semver/refs (`47`–`52`) (`1201-1352`)
    - `53`–`55`: 2.5D `elevationRange` (`floor < ceiling`), `parallaxLayers` unique depth per zone, `skylineRef` (`background` asset) (`1359-1463`)
    - `56`–`59`: `lootTables` IDs, positive finite entry weight, `quantity.min <= max`, `SpawnCondition` on loot & `EntityPlacement.spawnCondition` (`1475-1561`)
    - `60`–`65`: `transitions` IDs, closed `VALID_TRANSITION_TYPES`, finite `durationSeconds >= 0`, finite `gravityOverride`, sky/lighting metadata, `collisionType` (`1573-1651`)
    - `66`–`78`: `strata` IDs/`zRange`/finite `order`/`visibleStrata`, `Zone.stratumId`, `stratumLinks`, `hazardDefinitions` IDs/`trigger`/`passable`/`moveCostDelta`/effects, `Zone.hazardRefs`, `Zone.entryGate` (`1679-1868`)
    - `79`–`89`: `craftingStations`, `marketNodes`, `tilesets`, `tileDefinitions` global uniqueness, `tileLayers`/`TilePlacement.tileId`, `props`/`propPlacements`, `ambientLayers`, `buildings`, `hubs`, `strongholds` (`1903-2081`)
- **`advisoryValidation(project)` (`packages/schema/src/advisory.ts:39-257`):**
  - Metadata suggestions: missing `author` (`58`), `license` (`62`), empty `category` (`65`)
  - Flavor suggestions: unknown `genre` (`72`), unknown `tones[]` (`81`), unknown `difficulty` (`90`)
  - Structural tips: `< 2` zones (`99`), `0` connections (`102`)
  - AI RPG encounter compatibility `info`: non-`ambush|patrol|horde|duel` `encounterAnchors[].encounterType` (`109-122`, using `AI_RPG_ENCOUNTER_ANCHOR_TYPES` in `ai-rpg-encounter-types.ts:10`)
  - Asset hygiene: generic asset labels/paths (`128-142`)
  - Mode-specific tips (`switch (mode)` for `'dungeon' | 'world' | 'ocean' | 'space' | 'interior' | 'district' | 'wilderness'` + unknown mode default, `156-250`)
- **`presentationAdvisories(project)` (`packages/schema/src/presentation.ts:81-160`):** 8 rules (`Rule 1`–`Rule 8` at `92-156`) prefixed `presentation: ` (`presentation.ts:56,86`), checking unknown `zoneCells` keys (`Rule 1`), missing zone anchor for actor (`Rule 2`), actor cell outside zone span (`Rule 3`), missing `'player'` occupancy row (`Rule 4`), actor without sim placement (`Rule 5`), actor zone vs sim zone mismatch (`Rule 6`), unknown `floor` keys (`Rule 7`), duplicate actor IDs (`Rule 8`).
- **`scanDependencies(project)` (`packages/schema/src/dependencies.ts:9-19,133-435`) & `classifyHealth()` (`packages/schema/src/review.ts:189-194`):** 10 `DepDomain`s (`zone-asset`, `entity-asset`, `item-asset`, `landmark-asset`, `asset-pack`, `zone-ref`, `dialogue-ref`, `orphan-asset`, `orphan-pack`, `kit-provenance`); health classifies `blocked` -> `degraded` -> `healthy` -> `ready`.
- **`validateKit(kit)` (`packages/editor/src/kits/validate-kit.ts:16-68`):** errors (`Kit name is required`, `At least one mode is required`, `Invalid mode: ...`, `Project: ...`) and warnings (`Region preset ref not found: ...`, `Encounter preset ref not found: ...`).
- **Export-lane validation (`--validate-only` equivalents):**
  - **AI RPG Engine** (`packages/export-ai-rpg/src/cli.ts:500-547`): runs `exportToEngine(project)` (calls `validateProject(project)` at `export-ai-rpg/src/export.ts:311`) **plus** `listAiRpgEncounterBlockers(project)` (`export-ai-rpg/src/encounter-types.ts:31-45`), blocking any `encounterAnchor.encounterType` not in `['ambush', 'patrol', 'horde', 'duel']` (`ai-rpg-encounter-types.ts:10`).
  - **Unreal Engine 5** (`packages/export-unreal/src/cli.ts:164-187`): runs `exportToUnreal(project)` (`validateProject` at `export-unreal/src/export.ts:140`, plus finite `> 0` `options.tileSizeCm` at `128`).
  - **Godot 4** (`packages/export-godot/src/cli.ts:124-147`): runs `exportToGodot(project)` (`validateProject` at `export-godot/src/export.ts:136` + `presentationAdvisories` into `warnings`).

### 1.4 Saved Project (`WorldProject`) and Kit Bundle (`.wfkit.json`) Schemas

- **`WorldProject` top-level fields (`packages/schema/src/project.ts:24-126`):**
  - Metadata & identity: `id` (`25`), `name` (`26`), `description` (`27`), `version` (`28`), `genre` (`30`), `tones` (`31`), `difficulty` (`32`), `narratorTone` (`33`), `schemaVersion?` (`42`), `mode?` (`44`), `author?` (`47`), `license?` (`49`), `category?` (`51`), `projectTags?` (`53`).
  - Spatial & districts: `map: WorldMap` (`55`, `spatial.ts:6-12`), `zones: Zone[]` (`56`, `spatial.ts:38-108` including `entryGate?: ZoneEntryGate`, `physicsMode?`, `gravityOverride?`, `gravityDirection?`, `skyAtmosphereRef?`, `directionalLight*`, `skyLightIntensity?`, `timeOfDay?`, `collisionType?`, `elevationRange?`, `parallaxLayers?`, `skylineRef?`, `stratumId?`, `hazardRefs?`), `connections: ZoneConnection[]` (`57`, `spatial.ts:165-171`), `districts: District[]` (`58`, `districts.ts:4-11`), `landmarks: Landmark[]` (`59`, `spatial.ts:175-184`), `factionPresences` (`61`, `districts.ts:29-34`), `pressureHotspots` (`62`, `districts.ts:43-48`).
  - Narrative & character systems: `dialogues` (`64`, `dialogue.ts:40-44`), `playerTemplate?` (`66`, `player-template.ts:7-42`), `buildCatalog?` (`67`, `build-catalog.ts:98-110`), `progressionTrees` (`68`, `progression-tree.ts:27-32`).
  - Placements & economy: `entityPlacements` (`70`, `entities.ts:29-45`), `itemPlacements` (`71`, `entities.ts:55-76`), `encounterAnchors` (`72`, `entities.ts:120-132`), `spawnPoints` (`73`, `entities.ts:136-141`), `craftingStations` (`74`, `entities.ts:145-149`), `marketNodes` (`75`, `entities.ts:153-159`), `lootTables?` (`113`, `entities.ts:109-116`).
  - Town structures: `buildings?` (`82`, `town.ts:13-28`), `hubs?` (`83`, `town.ts:35-46`), `strongholds?` (`84`, `town.ts:53-64`).
  - World modeling & transitions: `strata?` (`91`, `stratum.ts:20-32`), `stratumLinks?` (`92`, `stratum.ts:40-49`), `hazardDefinitions?` (`99`, `hazard.ts:55-72`), `transitions?` (`118`, `spatial.ts:119-133`).
  - Visuals & assets: `tilesets` (`101`, `visual.ts:4-12`), `tileLayers` (`102`, `visual.ts:27-31`), `props` (`103`, `visual.ts:44-52`), `propPlacements` (`104`, `visual.ts:56-62`), `ambientLayers` (`105`, `visual.ts:66-72`), `assets` (`106`, `assets.ts:15-23`), `assetPacks` (`107`, `assets.ts:33-43`).
  - Drawing contract: `presentation?: WorldPresentation` (`125`, `presentation.ts:40-50`: `view`, `tile`, `span`, `zoneCells`, `floor?`, `occupancy`).
- **`.wfkit.json` Kit Bundle (`packages/editor/src/kits/bundle.ts:8,43-55`) & `StarterKit` (`packages/editor/src/kits/types.ts:5-23`):**
  - `KitBundle` (`bundle.ts:43-55`, `BUNDLE_VERSION = 1` at `8`): `bundleVersion`, `name`, `description`, `icon`, `modes`, `tags`, `project: WorldProject`, `presetRefs: { region: string[]; encounter: string[] }`, `guideHints: Partial<Record<string, { label: string; description: string }>>`, `version?`, `exportedAt`.
  - `StarterKit` (`types.ts:5-23`): adds runtime fields `id`, `builtIn`, `createdAt?`, `updatedAt?`, `source?: 'local' | 'imported'`.

---

## 2. Documentation Diff

### 2.1 Reconciliation Table

| Area / Claim | Status | Code Site | Doc Site | Details |
|---|---|---|---|---|
| Editor authoring tools (count & list) | `WRONG` | `packages/editor/src/panels/ToolPalette.tsx:10-21`, `store/editor-store.ts:40` | `README.md:154`, `handbook/architecture.md:95`, `handbook/accessibility.md:26` | Code has **10** tools (`select`, `zone-paint`, `connection`, `entity-place`, `landmark`, `spawn`, `tile-paint`, `prop-place`, `encounter-place`, `item-place`). `README.md:154` lists 8 (omits `tile-paint`, `prop-place`); `architecture.md:95` lists 7. `accessibility.md:26` matches all 10. |
| Keyboard shortcuts count & tool-key subset | `WRONG` | `packages/editor/src/hotkeys.ts:17-48` | `README.md:175,252`, `handbook/editor-workflow.md:391`, `handbook/beginners.md:184`, `handbook/architecture.md:110` | Code has **29** `HOTKEY_BINDINGS` (including **10** tool keys `V/Z/C/E/L/S/T/O/N/I`). `README.md:175,252` say "21 keyboard shortcuts" and `V/Z/C/E/L/S` ("6 tool-switching keys"); `editor-workflow.md:391` repeats `(V/Z/C/E/L/S)` right below a table listing all 10 keys; `architecture.md:110` says "13 bindings". |
| Workspace tabs list & order | `WRONG` | `packages/editor/src/App.tsx:171-184`, `store/editor-store.ts:41` | `README.md:137-150`, `handbook/architecture.md:95` | `App.tsx:171-184` has 14 tabs (`Objects` is #6 after `Dialogue`, and `Import`/`Diff` are conditional). `README.md:137-150` lists 12 static tabs with `Objects` #2 and omits `Import`/`Diff`; `architecture.md:95` puts `Objects` #2. |
| Viewport auto-fit on project load | `WRONG` | `packages/editor/src/Canvas.tsx:72,135-182` | `README.md:172`, `handbook/editor-workflow.md:230` | `Canvas.tsx:136-137` runs fit-to-content only once per `Canvas` mount via `hasFitted` ref (`[project.zones.length]`), never resetting when loading another project. |
| Selecting a zone opens its properties | `WRONG` | `packages/editor/src/store/editor-store.ts:410`, `panels/TemplateManager.tsx:131,139,149,159`, `Canvas.tsx:1259-1270`, `App.tsx:673,680` | `handbook/beginners.md:123` | Samples/kits/templates reset `rightTab` to `'guide'` via `resetChecklist()`. Single-clicking a zone calls `selectHit`/`selectZone`, leaving `rightTab` on `'guide'` instead of `'map'`. |
| Export modal per-target readiness badge | `WRONG` | `packages/editor/src/panels/ExportModal.tsx:73-107` | `README.md:55`, `handbook/beginners.md:145`, `handbook/editor-workflow.md:672-676` | Docs describe only `✓ Ready` / `✓ Ready with N advisories`; code renders `✗ Not ready (N blocker)` for blocked targets inside a container hardcoded with green `--wf-success` styling (`ExportModal.tsx:75`). |
| Context menu actions | `WRONG` | `packages/editor/src/speed-panel-actions.ts:118-152,206-218` | `README.md:162`, `handbook/editor-workflow.md:246` | Docs claim context menu has `"properties, delete, duplicate, copy, hide..."`. Neither `copy` nor `hide` exists in `SPEED_PANEL_ACTIONS`. |
| Speed Panel zone/global actions list | `WRONG` | `packages/editor/src/speed-panel-actions.ts:118-152` | `handbook/editor-workflow.md:480-489` | Docs omit `Place Encounter Here`, mode connection actions (`Draw Secret/Channel/Warp/Trail Connection`), `Merge Zones`, `Set Elevation`, `Open Review`, and `Export Summary`. |
| ToolPalette Layers toggles count | `WRONG` | `packages/editor/src/panels/ToolPalette.tsx:153-167` | `handbook/editor-workflow.md:564` | `editor-workflow.md:564` claims "7 visibility toggles"; `ToolPalette.tsx` renders 11 layer toggles plus 3 editor toggles (14 `LayerChip` controls). |
| Auto-save crash recovery prompt | `WRONG` | `packages/editor/src/App.tsx:108-123`, `store/project-store.ts:587-603` | `handbook/editor-workflow.md:399` | Doc claims "a recovery prompt offers to restore the saved project or discard it"; code automatically restores on boot and shows a toast. |
| Space Station Hub preset Commerce metric | `WRONG` | `packages/editor/src/presets/built-ins.ts:126` | `handbook/editor-workflow.md:420` | Preset has `commerce: 70, safety: 60`; doc table states `Commerce 60, Safety 65` (`65` is `stability`). |
| Built-in sample count | `WRONG` | `packages/editor/src/templates/samples.ts:1019-1050` | `handbook/architecture.md:115` | `architecture.md:115` says `sample worlds (6 intermediate)`; `SAMPLE_WORLDS` has 9 entries (`1` minimal, `7` intermediate, `1` rich). |
| `UnrealContentPack` `FormatVersion` | `WRONG` | `packages/export-unreal/src/export.ts:73,286` | `handbook/export-unreal.md:55` | `UNREAL_PACK_FORMAT_VERSION` is `'1.3.0'`; doc states **`1.1.0`**. |
| AI RPG `ContentPack` emitted fields snippet | `WRONG` | `packages/export-ai-rpg/src/export.ts:597-637` | `handbook/export.md:36-55` | Doc snippet omits `itemPlacements`, `spawnPoints`, `landmarks`, `strata`, `stratumLinks`, `transitions`, `buildings`, `hubs`, `strongholds`. |
| Zone Merge in Selection Actions panel | `WRONG` | `packages/editor/src/panels/SelectionActionsPanel.tsx:91-195`, `speed-panel-actions.ts:143` | `handbook/editor-workflow.md:652` | `Merge Zones` is only in `SPEED_PANEL_ACTIONS` (Speed Panel / context menu), not in `SelectionActionsPanel`. |
| Layout Templates in UI | `DOCUMENTED-NOT-BUILT` | `packages/editor/src/templates/layout-templates.ts:176` | `README.md:247`, `handbook/index.md:43`, `handbook/editor-workflow.md:623-637` | `LAYOUT_TEMPLATES` has zero UI callers; template names in `editor-workflow.md:629-634` (`Linear Corridor`, `Hub and Spoke`, etc.) also do not match the arrays in `layout-templates.ts`. |
| Dialogue Templates in UI | `DOCUMENTED-NOT-BUILT` | `packages/editor/src/templates/dialogue-templates.ts:133` | `README.md:247`, `handbook/index.md:43`, `handbook/editor-workflow.md:638-649` | `DIALOGUE_TEMPLATES` has zero non-test UI callers. |
| Batch Entity Placement (`Grid`/`Random`/`Circle`) in UI | `DOCUMENTED-NOT-BUILT` | `packages/editor/src/store/project-store.ts:430,1741` | `README.md:248`, `handbook/index.md:44`, `handbook/editor-workflow.md:654-665` | `batchPlaceEntities` exists in `project-store.ts`, with zero UI callers in `SelectionActionsPanel`, `SpeedPanel`, or elsewhere. |
| World-level `StrataPanel` & `HazardLibraryPanel` | `UNDOCUMENTED` / UI bug | `packages/editor/src/App.tsx:684-685`, `panels/HazardLibraryPanel.tsx:55,183` | `README.md:212-213` | Vertical strata and hazards are described as schema concepts, while UI mounting condition and duplicate `+ Add hazard` empty-state button (`55`, `183`) are undocumented. |
| Advisory suggestions default-collapsed UI state | `UNDOCUMENTED` | `packages/editor/src/panels/ValidationPanel.tsx:157` | `handbook/editor-workflow.md` | Suggestions accordion in the `Issues` tab defaults to collapsed (`collapsed['advisory'] ?? true`). |
| `Mode` stored on `WorldProject`, 12 connection kinds, 89 validation rules, 3 export targets | `MATCH` | `packages/schema/src/project.ts:44`, `validate.ts:496-2081`, `spatial.ts:160` | `README.md:201,208`, `handbook/beginners.md:95,159`, `handbook/schema.md` | Schema and validation counts align with docs. |

### 2.2 Runtime Behavior Confirmations

1. **Viewport does not auto-fit when loading a project:** **Confirmed.** In `packages/editor/src/Canvas.tsx:72`, `hasFitted` is a `useRef(false)` local to the mounted `Canvas` component. The auto-fit `useEffect` (`Canvas.tsx:135-182`) bails out immediately when `hasFitted.current || project.zones.length === 0`, sets `hasFitted.current = true` once (`137`), and depends only on `[project.zones.length]`. Loading another project via `loadProject` (`project-store.ts:795`) never resets `hasFitted.current`, so loaded zones positioned outside the prior viewport stay off-screen.
2. **Selecting a zone does not show its properties:** **Confirmed.** Opening any template, starter kit, sample world, or user template invokes `resetChecklist()` (`packages/editor/src/panels/TemplateManager.tsx:131,139,149,159`), which explicitly sets `rightTab: 'guide'` (`packages/editor/src/store/editor-store.ts:410`). Single-clicking a zone on the canvas (`Canvas.tsx:1259-1270`) calls `selectHit`/`selectZone` without calling `setRightTab('map')`, while `<ZoneProperties />` only renders when `rightTab === 'map'` (`App.tsx:673,680`). Only double-clicking (`Canvas.tsx:1752`), pressing `Enter` (`hotkeys.ts:245`), or executing `'edit-props'` switches to `'map'`.
3. **Export readiness container is green beside red `"Not ready"` text:** **Confirmed.** In `packages/editor/src/panels/ExportModal.tsx:75`, `TargetReadinessSummary` wraps all target rows in a single box whose styles hardcode `background: 'color-mix(in srgb, var(--wf-success) 18%, var(--wf-bg-panel))'` and `border: '1px solid var(--wf-success)'`, regardless of `targetReadiness.*.ready`, while lines `84-94` render a red `✗` and `Not ready (1 blocker)` (`var(--wf-danger-text)`) whenever `!info.ready`.

---

## 3. Headless Sample, Kit, Template, and Preset Audit

Checks run against built workspace packages mirroring each CLI's `--validate-only` pipeline:
- **Load:** `useProjectStore.getState().loadProject(structuredClone(project))`
- **Schema Validate:** `validateProject(project)` (`@world-forge/schema`)
- **Advisory:** `advisoryValidation(project)` (`@world-forge/schema`)
- **AI RPG `--validate-only`:** `exportToEngine(project)` **and** `listAiRpgEncounterBlockers(project)` (`packages/export-ai-rpg/src/cli.ts:500-547`)
- **UE5 `--validate-only`:** `exportToUnreal(project)` (`packages/export-unreal/src/cli.ts:164-187`)
- **Godot 4 `--validate-only`:** `exportToGodot(project)` (`packages/export-godot/src/cli.ts:124-147`)

### 3.1 Sample Worlds, Starter Kits, Genre Templates, and Mode Starters

| Registry & ID | Name | Load | `validateProject` | `advisoryValidation` | AI RPG (`--validate-only`) | UE5 | Godot 4 | Blocker Code / Field / Code Site |
|---|---|---|---|---|---|---|---|---|
| `SAMPLE_WORLDS` `hello-world` | Hello World | PASS | PASS (0) | 6 items | PASS | PASS | PASS | — |
| `SAMPLE_WORLDS` `tavern-crossroads` | Tavern Crossroads | PASS | PASS (0) | 3 items | PASS | PASS | PASS | — |
| `SAMPLE_WORLDS` `chapel-threshold` | Chapel Threshold | PASS | PASS (0) | 4 items | **FAIL** | PASS | PASS | `encounterAnchors.crypt-encounter.encounterType`: `'boss'` not in `AI_RPG_ENCOUNTER_ANCHOR_TYPES` (`samples.ts:182`) |
| `SAMPLE_WORLDS` `ocean-harbor` | Smuggler's Cove | PASS | PASS (0) | 6 items | **FAIL** | PASS | PASS | `encounterAnchors.patrol-intercept.encounterType`: `'pirate'` (`samples.ts:409`) |
| `SAMPLE_WORLDS` `space-station` | Mining Outpost | PASS | PASS (0) | 7 items | **FAIL** | PASS | PASS | `encounterAnchors.drill-malfunction.encounterType`: `'boarding'` (`samples.ts:527`) |
| `SAMPLE_WORLDS` `wilderness-trail` | Thornwood Path | PASS | PASS (0) | 5 items | **FAIL** | PASS | PASS | `encounterAnchors.bear-territory.encounterType`: `'beast'` (`samples.ts:646`) |
| `SAMPLE_WORLDS` `city-market` | Dockside Market | PASS | PASS (0) | 4 items | **FAIL** | PASS | PASS | `encounterAnchors.alley-mugging.encounterType`: `'brawl'` (`samples.ts:763`) |
| `SAMPLE_WORLDS` `world-map` | Iron Steppe | PASS | PASS (0) | 6 items | **FAIL** | PASS | PASS | `encounterAnchors.raider-ambush.encounterType`: `'caravan-raid'` (`samples.ts:882`) |
| `SAMPLE_WORLDS` `cabin-interior` | Keeper's Lodge | PASS | PASS (0) | 5 items | **FAIL** | PASS | PASS | `encounterAnchors.cellar-lurker.encounterType`: `'haunt'` (`samples.ts:1001`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `dungeon-starter` | Forgotten Vault | PASS | PASS (0) | 2 items | PASS | PASS | PASS | `validateKit`: PASS (`templates/mode-dungeon.ts:107` uses `'patrol'`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `district-starter` | Market Quarter | PASS | PASS (0) | 5 items | **FAIL** | PASS | PASS | `encounterAnchors.alley-brawl.encounterType`: `'brawl'` (`templates/mode-district.ts:107`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `world-starter` | Contested Frontier | PASS | PASS (0) | 6 items | **FAIL** | PASS | PASS | `encounterAnchors.caravan-ambush.encounterType`: `'caravan-raid'` (`templates/mode-world.ts:107`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `ocean-starter` | Corsair Strait | PASS | PASS (0) | 6 items | **FAIL** | PASS | PASS | `encounterAnchors.pirate-raid.encounterType`: `'pirate'` (`templates/mode-ocean.ts:107`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `space-starter` | Relay Station | PASS | PASS (0) | 9 items | **FAIL** | PASS | PASS | `encounterAnchors.drone-swarm.encounterType`: `'boarding'` (`templates/mode-space.ts:107`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `interior-starter` | Clockwork Manor | PASS | PASS (0) | 5 items | **FAIL** | PASS | PASS | `encounterAnchors.cellar-haunt.encounterType`: `'haunt'` (`templates/mode-interior.ts:107`) |
| `BUILTIN_KITS` / `MODE_STARTERS` `wilderness-starter` | Wolf Ridge | PASS | PASS (0) | 6 items | **FAIL** | PASS | PASS | `encounterAnchors.wolf-ambush.encounterType`: `'beast'` (`templates/mode-wilderness.ts:107`) |
| `GENRE_TEMPLATES` `fantasy` (raw & wizard) | Fantasy | PASS | PASS (0) | 4 / 3 items | PASS | PASS | PASS | — |
| `GENRE_TEMPLATES` `cyberpunk` (raw & wizard) | Cyberpunk | PASS | PASS (0) | 5 / 4 items | PASS | PASS | PASS | — |
| `GENRE_TEMPLATES` `detective` (raw & wizard) | Detective | PASS | PASS (0) | 5 / 4 items | PASS | PASS | PASS | — |
| `GENRE_TEMPLATES` `pirate` (raw & wizard) | Pirate | PASS | PASS (0) | 6 / 5 items | PASS | PASS | PASS | — |
| `GENRE_TEMPLATES` `zombie` (raw & wizard) | Zombie | PASS | PASS (0) | 5 / 4 items | PASS | PASS | PASS | — |

### 3.2 Built-in Region Presets (`BUILTIN_REGION_PRESETS`)

Applied via `applyRegionPreset` (both `merge` and `overwrite`) on `hello-world`: all **9** region presets (`crypt-district`, `market-ward`, `chapel-grounds`, `smuggler-dock`, `ocean-port`, `space-station-hub`, `wilderness-camp`, `dungeon-vault`, `city-slum`) pass `validateProject`, AI RPG `--validate-only`, UE5 `--validate-only`, and Godot 4 `--validate-only`.

### 3.3 Built-in Encounter Presets (`BUILTIN_ENCOUNTER_PRESETS`)

Applied via `createEncounterFromPreset` on `hello-world`: **9 of 10** built-in encounter presets produce encounter anchors refused by the AI RPG Engine export lane (`listAiRpgEncounterBlockers`, `export-ai-rpg/src/encounter-types.ts:31-45`, allowed set `AI_RPG_ENCOUNTER_ANCHOR_TYPES = ['ambush', 'patrol', 'horde', 'duel']` at `packages/schema/src/ai-rpg-encounter-types.ts:10`). All 10 pass `validateProject`, UE5, and Godot 4.

| Preset ID | Code Site | `encounterType` | AI RPG Lane | UE5 / Godot 4 | Blocker Reason |
|---|---|---|---|---|---|
| `boss-encounter` | `packages/editor/src/presets/built-ins.ts:206-216` (`encounterType` at `:211`) | `'boss'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `hazard-encounter` | `packages/editor/src/presets/built-ins.ts:218-228` (`encounterType` at `:223`) | `'hazard'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `discovery-encounter` | `packages/editor/src/presets/built-ins.ts:230-240` (`encounterType` at `:235`) | `'discovery'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `dungeon-ambush` | `packages/editor/src/presets/built-ins.ts:243-254` (`encounterType` at `:249`) | `'ambush'` | PASS | PASS / PASS | — |
| `district-brawl` | `packages/editor/src/presets/built-ins.ts:256-267` (`encounterType` at `:262`) | `'brawl'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `world-caravan-raid` | `packages/editor/src/presets/built-ins.ts:269-280` (`encounterType` at `:275`) | `'caravan-raid'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `ocean-pirate-attack` | `packages/editor/src/presets/built-ins.ts:282-293` (`encounterType` at `:288`) | `'pirate'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `space-boarding-action` | `packages/editor/src/presets/built-ins.ts:295-306` (`encounterType` at `:301`) | `'boarding'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `interior-haunt` | `packages/editor/src/presets/built-ins.ts:308-319` (`encounterType` at `:314`) | `'haunt'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
| `wilderness-beast-hunt` | `packages/editor/src/presets/built-ins.ts:321-332` (`encounterType` at `:327`) | `'beast'` | **FAIL** | PASS / PASS | Not in `ambush, patrol, horde, duel` |
