# Design Notes — Templates as Systems & Region Presets

> Originally written for v2.9. Architectural decisions below still apply.

## Architecture decisions

**Preset types live in `packages/editor/src/presets/`** — not in schema. Presets are editor tooling, not project data. When applied, they write normal schema types (District, EncounterAnchor, FactionPresence, PressureHotspot). No preset metadata survives into export.

**Preset store mirrors template-store** — Zustand + localStorage. Built-in presets are immutable, user presets are full CRUD.

**Hotkeys extracted to `hotkeys.ts`** — centralized dispatch table, replaces inline handlers in Canvas.tsx. Existing input-safe guard preserved.

**Double-click uses existing `findHitAt`** — hit-testing already returns typed results. Double-click dispatches to the correct panel by switching rightTab + selecting the object.

---

## Slice 1 — Preset Types + Store + Built-in Library + Apply Logic

**New files:**
- `packages/editor/src/presets/types.ts` — RegionPreset, EncounterPreset interfaces
- `packages/editor/src/presets/built-ins.ts` — 4 region + 3 encounter starter presets
- `packages/editor/src/presets/preset-store.ts` — Zustand CRUD + localStorage
- `packages/editor/src/presets/index.ts` — barrel export

**RegionPreset shape:**
```ts
interface RegionPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  genre?: string;
  builtIn: boolean;
  // What it applies:
  regionTags: string[];
  controllingFaction?: string;
  baseMetrics: Partial<DistrictMetrics>;
  economyProfile?: Partial<EconomyProfile>;
  factionPresences: Array<Omit<FactionPresence, 'districtIds'>>;
  pressureHotspots: Array<Omit<PressureHotspot, 'id' | 'zoneId'>>;
}
```

**EncounterPreset shape:**
```ts
interface EncounterPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  genre?: string;
  builtIn: boolean;
  // What it applies:
  encounterType: string;
  enemyIds: string[];
  probability: number;
  cooldownTurns: number;
  encounterTags: string[];
}
```

**Built-in region presets (4):**
- `crypt-district` — undead faction, low commerce/morale, undead-surge pressure, dark/cramped tags
- `market-ward` — merchant guild faction, high commerce, trade-dispute pressure, bustling/trade tags
- `chapel-grounds` — clergy faction, high morale/stability, divine-incursion pressure, sacred/quiet tags
- `smuggler-dock` — smuggler ring faction, low safety, contraband-raid pressure, shady/waterfront tags

**Built-in encounter presets (3):**
- `boss-encounter` — type: boss, probability 1.0, cooldown 0, tags [boss, scripted]
- `hazard-encounter` — type: hazard, probability 0.6, cooldown 2, tags [environmental, trap]
- `discovery-encounter` — type: discovery, probability 0.4, cooldown 5, tags [lore, reward]

**Apply logic — added to project-store.ts:**
- `applyRegionPreset(districtId: string, preset: RegionPreset, mode: 'merge' | 'overwrite')` — single updateProject call (one undo step). Merge: only fill empty/default fields. Overwrite: replace all preset-covered fields.
- `createEncounterFromPreset(zoneId: string, preset: EncounterPreset)` — creates EncounterAnchor with preset defaults, single undo step.

**Tests:**
- `presets/preset-store.test.ts` — CRUD, localStorage persistence, built-in immutability
- `presets/apply.test.ts` — merge vs overwrite, undo/redo round-trip, faction/pressure creation

**Build gate:** tsc clean, all tests pass.

---

## Slice 2 — Preset Library UI

**New file:**
- `packages/editor/src/panels/PresetBrowser.tsx` — preset browser panel

**PresetBrowser layout:**
- Two sub-tabs: "Region" | "Encounter"
- Each shows: preset cards with name, description, tag chips, genre affinity
- Built-in presets marked with lock icon, user presets editable
- Actions per preset: Apply, Duplicate (user only), Delete (user only)
- "Save Current" button (context: saves selected district as region preset, or selected encounter as encounter preset)
- Apply shows inline preview: what fields will change, merge vs overwrite toggle

**Wiring:**
- Add "Presets" tab to right sidebar tab bar in App.tsx
- `rightTab === 'presets'` renders `<PresetBrowser />`
- Apply button reads current selection to determine target district/zone
- Apply calls `applyRegionPreset` or `createEncounterFromPreset` from project-store

**Build gate:** tsc clean, all tests pass.

---

## Slice 3 — Hotkey Registry + New Shortcuts

**New file:**
- `packages/editor/src/hotkeys.ts` — centralized hotkey dispatch

**Hotkey registry shape:**
```ts
interface HotkeyBinding {
  key: string;          // e.g. 'KeyP', 'Enter', 'Space'
  ctrl?: boolean;
  shift?: boolean;
  action: string;       // semantic name: 'apply-preset', 'save-preset', 'open-details'
  label: string;        // human-readable: 'Apply preset'
  description: string;  // tooltip text
}
```

**Migration:** Extract all keyboard handling from Canvas.tsx useEffect into `hotkeys.ts`. Canvas calls `dispatchHotkey(e, context)` which returns whether the event was handled. Context provides selection, project, store actions.

**New shortcuts:**
| Key | Action | Condition |
|-----|--------|-----------|
| Enter | Open details for selected object | Single selection |
| P | Open preset browser / apply preset | District or zone selected |
| Shift+P | Save current district/encounter as preset | District or encounter selected |

**Input guard:** Preserved from existing code — skip when `e.target` is INPUT/TEXTAREA/SELECT.

**Hotkey reference:** Add `HotkeyReference` section to Guide tab (ChecklistPanel.tsx) — simple table of all shortcuts.

**Canvas.tsx changes:**
- Remove inline keyboard handlers
- Add `dispatchHotkey` call
- Keep Space (pan mode) and onKeyUp locally (they depend on refs)

**Tests:**
- `hotkeys.test.ts` — dispatch logic, input-safe guard, modifier detection

**Build gate:** tsc clean, all tests pass.

---

## Slice 4 — Double-Click Panel Affordance

**Canvas.tsx `handleDoubleClick` rewrite:**
```ts
const handleDoubleClick = (e: React.MouseEvent) => {
  const { sx, sy } = getScreenXY(e);
  const { gx, gy } = gridPos(e);

  // Use hit-testing to find what's under the cursor
  const hit = findHitAt(project, sx, sy, viewport, tileSize, visFlags);

  if (!hit) {
    clearSelection();
    return;
  }

  // Select the object
  switch (hit.type) {
    case 'zone':
      selectZone(hit.id, false);
      break;
    case 'encounter':
      selectEncounter(hit.id, false);
      break;
    case 'entity':
      selectEntity(hit.id, false);
      break;
    case 'landmark':
      selectLandmark(hit.id, false);
      break;
    case 'spawn':
      selectSpawn(hit.id, false);
      break;
    case 'connection': {
      const [from, to] = hit.id.split('::');
      selectConnection(from, to);
      break;
    }
  }

  // Switch to map tab to show the properties panel
  setRightTab('map');

  // Center viewport on the object
  // (reuse existing centerOnZone or compute from object position)
};
```

**Key behavior:**
- Double-click encounter → selects encounter → EncounterProperties appears
- Double-click zone → selects zone → ZoneProperties appears
- Double-click connection → selects connection → ConnectionProperties appears
- Double-click entity/landmark/spawn → selects it → map tab shows selection
- Double-click empty canvas → clears selection
- Always centers viewport on target
- Single-click vs double-click: no conflict (mousedown handles single-click, onDoubleClick fires separately)

**Tests:**
- `double-click.test.ts` — hit type dispatch, panel activation, empty canvas behavior

**Build gate:** tsc clean, all tests pass.

---

## Slice 5 — Search/Objects Integration + Polish

**SearchOverlay.tsx updates:**
- Add `'region-preset' | 'encounter-preset'` to SearchResult type
- Index all presets (built-in + user) in buildSearchIndex
- Navigate: selecting a preset switches to Presets tab
- TYPE_ICONS: `'region-preset': 'Rgn'`, `'encounter-preset': 'Enc'`
- TYPE_COLORS: `'region-preset': '#8b5cf6'`, `'encounter-preset': '#da3633'`

**ObjectListPanel.tsx updates:**
- No preset badge needed — presets apply as normal authored data, objects stay clean

**Canvas visual feedback:**
- On `applyRegionPreset`: briefly flash the affected district zones (highlight for 500ms)
- On `createEncounterFromPreset`: auto-select the new encounter

**Workflow integration:**
- P hotkey: if district selected → open Presets tab + focus region sub-tab; if zone selected → open Presets tab + focus encounter sub-tab
- Enter hotkey: if on Presets tab with preset highlighted → apply preset

**Build gate:** tsc clean, all tests pass.

---

## Slice 6 — Tests + Docs + Release

**Regression tests:**
- Search still finds zones/entities/encounters/connections
- Existing selection/edit flows unchanged
- Import/export round-trip unaffected (presets don't appear in export)
- Undo/redo stack integrity after preset apply

**Manual verification:**
- Apply crypt-district preset to Chapel Grounds → verify metrics, faction, pressure appear
- Apply market-ward preset to a new district → verify economy profile
- Create encounter from boss-encounter preset → verify red diamond on canvas
- Save custom region preset from edited district → verify it appears in browser
- Duplicate + reapply custom preset
- Undo/redo preset application
- Enter opens details for selected zone/encounter/connection
- P opens preset browser contextually
- Double-click zone/encounter/connection opens correct panel
- Ctrl+K finds presets by name
- Hotkeys don't fire in text inputs
- Zero console errors

**Docs:**
- Root README.md — add preset and quick-action capabilities
- packages/editor/README.md — add preset system, hotkeys, double-click
- site/src/content/docs/handbook/editor-workflow.md — new sections for presets, hotkeys, double-click
- site/src/content/docs/handbook/architecture.md — add preset modules, hotkey registry
- CHANGELOG.md — v2.9.0 entry

**Release:**
- Bump all 5 package.json to 2.9.0
- `tsc --build` clean
- All tests pass
- Commit, push, publish
