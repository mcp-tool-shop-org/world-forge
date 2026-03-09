---
title: Editor Workflow
description: Step-by-step guide to authoring worlds in the editor
sidebar:
  order: 2
---

The World Forge editor is a React web app that provides a visual authoring surface for world projects. Here is the typical workflow from empty canvas to exported ContentPack.

## 1. Paint Zones

Select the **Zone** tool from the tool palette. Click and drag on the canvas to create rectangular zones. Each zone represents a distinct area in your world — a room, corridor, courtyard, or cave.

Zone properties you can set:

- **Name and description** — what the player sees
- **Tags** — `indoor`, `outdoor`, `safe`, `dangerous`, `hidden`, etc.
- **Light and noise** — ambient levels (0-10 scale)
- **Hazards** — environmental dangers like `crumbling-floor` or `toxic-spores`
- **Interactables** — objects players can inspect or use
- **Exits** — labeled transitions to other zones

## 2. Connect Zones

Select the **Connection** tool. Click zone A, then click zone B to draw a connection. Connections can be:

- **Bidirectional** — players can travel both ways (default)
- **One-way** — players can only travel in one direction

Connections automatically update each zone's neighbor list. The validator checks that neighbors are symmetrical for bidirectional connections.

### Selecting & Editing Connections

In **Select** mode, click any connection line to select it. Selected connections are highlighted in blue. The **Connection Properties** panel appears in the sidebar with:

- **From / To** — read-only zone names
- **Label** — optional display label; labels appear at the line midpoint when zoomed in above 30%
- **Kind** — semantic path type: Passage (default), Door, Stairs, Road, Portal, Secret, or Hazard. Each kind has a distinct visual style on the canvas (color and dash pattern)
- **Bidirectional** — checkbox toggle; non-bidirectional connections show an arrowhead on the canvas
- **Condition** — optional condition string (e.g. `has-tag:chapel-key`); conditional connections render as dashed lines. Condition dashing takes priority over kind dashing
- **Swap Direction** — reverses the from/to direction (non-bidirectional only)
- **Delete** — removes the connection

Connection lines are edge-anchored — they connect at zone edges via ray-rectangle intersection rather than zone centers. This produces cleaner routing, especially after zone resize. Connections are also listed in the **Objects** tab (with kind badges) and indexed in **Ctrl+K** search (searchable by kind name).

Press **Delete** or **Backspace** with a connection selected to remove it. Undo restores the connection in one step.

## 3. Create Districts

Open the **District** panel in the left sidebar. Create districts to group zones into logical regions — a chapel grounds, crypt depths, market quarter, etc. Click the expand arrow on any district to access the full region editor.

District properties:

- **Zone membership** — which zones belong to this district; select zones and click "Assign" to add them
- **Controlling faction** — which faction holds this territory
- **Base metrics** — 4 range sliders: commerce, morale, safety, stability (0-100)
- **Tags** — comma-separated freeform tags (e.g. `sacred`, `underground`)
- **Economy profile** — supply categories and scarcity defaults (key=value per line)

### Faction Presences

The expanded district panel includes a **Faction Presences** sub-section listing all factions that operate in the district. Each faction entry has:

- **Influence** — range slider (0-100) for faction control strength
- **Alert level** — range slider (0-100) for faction readiness
- **Remove** — delete the faction from this district

Click **+ Faction** to add a new faction presence to the district.

### Pressure Hotspots

The **Pressure Hotspots** sub-section lists zones in the district where world pressures are more likely to trigger. Each hotspot has:

- **Type** — the pressure event type (e.g. `undead-surge`, `bandit-raid`)
- **Probability** — base trigger probability (0-1)
- **Tags** — freeform tags for filtering

Click **+ Hotspot** to add a new pressure hotspot (placed in the first zone of the district).

### Removing Districts

Click **Remove District** at the bottom of the expanded panel. This deletes the district and clears `parentDistrictId` from all affected zones — the zones themselves are preserved.

District name labels appear as muted large text at the centroid of each district's zones when zoomed above 25%.

## 4. Place Encounters

Select the **Encounter** tool (or use the encounter-place tool). Click on any zone to place an encounter anchor — a point where encounters can trigger during gameplay.

Encounters appear as red diamond markers at the zone center on the canvas. Multiple encounters in the same zone are offset horizontally to remain distinguishable. The marker color varies by encounter type:

| Type | Color |
|------|-------|
| Boss | Bright red (#f85149) |
| Ambush | Orange (#d29922) |
| Patrol | Muted yellow (#8b8422) |
| Default | Red (#da3633) |

Click an encounter to select it. The **Encounter Properties** panel appears with:

- **ID** — read-only identifier
- **Zone** — read-only zone name
- **Encounter Type** — text input (boss, patrol, ambush, etc.)
- **Enemy IDs** — comma-separated entity references
- **Probability** — trigger probability (0-1)
- **Cooldown Turns** — turns before the encounter can trigger again
- **Tags** — comma-separated freeform tags
- **Delete** — remove the encounter

Encounters are also listed in the **Objects** tab (red "Enc" badges under each zone) and indexed in **Ctrl+K** search (searchable by type, ID, and zone name).

## 5. Place Entities

Select the **Entity** tool. Click on a zone to place an entity. Choose a role:

| Role | Engine Type | Default Tags |
|------|------------|--------------|
| NPC | npc | — |
| Enemy | enemy | hostile |
| Merchant | npc | merchant, trader |
| Quest Giver | npc | quest-giver |
| Companion | npc | recruitable, companion |
| Boss | enemy | hostile, boss, elite |

Entity properties include stats (vigor, instinct, will), resources (hp, stamina), AI profile, faction, tags, and custom metadata for companion abilities or personal goals.

## 6. Manage Assets

Open the **Assets** tab in the right sidebar. Click **+ Add Asset** to register a media file in your project's asset manifest. Each asset has:

- **Kind** — `portrait`, `sprite`, `background`, `icon`, or `tileset`
- **Label** — display name
- **Path** — relative file path or URI to the media file
- **Version** — optional version string
- **Tags** — freeform tags for filtering

Once assets are registered, bind them to world objects:

- **Zones** — select a zone and choose a background or tileset from the asset dropdowns in Zone Properties
- **Entities** — assign portrait and sprite assets to entity placements
- **Items** — assign icon assets to item placements

### Asset Packs

Group related assets into named, versioned packs for portability. Click **+ Add Pack** to create a pack with a label, version, description, tags, theme, license, and author. Then assign assets to packs using the Pack dropdown on each asset card.

Use the **Group** checkbox to view assets organized by pack, with an "Unassigned" section for loose assets. The validator warns about orphaned packs (packs with no assets) and checks that all pack references are valid.

The validator checks that all asset references point to existing assets of the correct kind. The Assets tab shows an orphan count for unreferenced assets.

## 7. Canvas Viewport

The canvas uses a real camera model with pan and zoom. All content is drawn in world coordinates and projected through a viewport transform.

### Navigation

| Action | Input |
|--------|-------|
| Pan | Right-click drag, Spacebar + drag, or middle-mouse drag |
| Zoom | Mousewheel (anchored to cursor position) |
| Fit all content | Click **Fit** in viewport controls |
| Center on selected zone | Click **Center** in viewport controls |
| Center on any zone | Double-click a zone on the canvas |
| Reset to origin at 100% | Click **Reset** in viewport controls |

The viewport auto-fits all content when a project first loads, so zones at any grid position are immediately visible.

### Viewport Controls

The **Viewport** section in the tool palette provides:

- **+/-** buttons — step zoom in/out by 10%
- **Percentage** — current zoom level (10% to 500%)
- **Fit** — frame all project content in the canvas
- **Center** — frame the selected zone (disabled when no zone selected)
- **Reset** — return to origin (0,0) at 100% zoom

### Legibility

Zone labels have dark background pills for readability at any zoom level. Line widths, entity markers, landmark diamonds, and spawn squares are zoom-compensated so they maintain a consistent screen size. Selected zones show brighter fills, thicker borders, and white label text.

## 8. Selection & Editing

The canvas supports rich selection and spatial editing workflows for working with multiple objects at once.

### Selecting Objects

| Action | Input |
|--------|-------|
| Select one object | Click it |
| Add to selection | Shift + click |
| Box select | Click and drag a rectangle (select tool) |
| Select all | Ctrl+A |
| Deselect all | Escape |

Hit priority when clicking: spawns > encounters > landmarks > entities > connections > zones. If objects overlap, repeated clicks at the same spot cycle through all hits — no need to move objects out of the way.

### Moving & Duplicating

Drag any selected object (or group) to reposition it. A 3px dead-zone prevents accidental moves. All moves are atomic — one undo step reverts the entire drag.

Press **Ctrl+D** to duplicate the current selection. Duplicates appear offset by 2 grid cells with remapped IDs, `(copy)` name suffixes, and preserved district membership. Connections between co-selected zones are duplicated; connections to non-selected zones are dropped. Duplicated spawns are always non-default.

### Aligning & Distributing

When 2+ objects are selected, the **Selection Actions** panel appears in the right sidebar with layout tools:

**Align** (6 operations) — move all selected objects so a shared edge or center line matches:

| Button | Effect |
|--------|--------|
| Left | All left edges align to the leftmost object |
| Center H | All horizontal centers align to the selection's center |
| Right | All right edges align to the rightmost object |
| Top | All top edges align to the topmost object |
| Center V | All vertical centers align to the selection's center |
| Bottom | All bottom edges align to the bottommost object |

**Distribute** (2 operations, requires 3+ objects) — space objects evenly between the first and last:

- **Horizontal** — even spacing along the X axis
- **Vertical** — even spacing along the Y axis

The first and last objects (by center position) stay in place; intermediate objects are repositioned. All results snap to integer grid coordinates.

Zones align by bounding box edges. Point objects (entities, landmarks, spawns) align by their grid position. Mixed-type alignment is supported — you can align a landmark to the left edge of a group of zones.

Entities without explicit grid coordinates (those positioned relative to their zone) are materialized with explicit coordinates when aligned. This is reversible via undo.

### Snapping & Guides

When **Snap to Objects** is enabled (on by default), dragging selected objects near the edges or centers of non-selected objects will snap to alignment.

| Snap Target | What Snaps |
|-------------|-----------|
| Zone left/right edges | Selection left/right edges |
| Zone top/bottom edges | Selection top/bottom edges |
| Zone center-x/center-y | Selection center-x/center-y |
| Point object positions | Selection edges |

X and Y axes snap independently — you can snap horizontally without affecting vertical position. The snap radius is 1 grid cell: when any selection edge is within 1 cell of a target, it snaps to exact alignment.

**Visual feedback during drag:**

- **Drag preview** — selected objects render at their snapped position in real-time, not their original position
- **Guide lines** — cyan dashed lines appear at snap alignment positions, spanning from the selection to the target object
- **Connection preview** — zone connections follow dragged zones during drag

Toggle snapping off in the Layers section of the tool palette to drag freely without snap behavior.

### Resize Handles

When exactly one zone is selected, 8 resize handles appear — 4 at corners and 4 at edge midpoints. Drag any handle to reshape the zone:

| Handle | Effect |
|--------|--------|
| Corner (nw/ne/sw/se) | Resize both width and height simultaneously |
| Edge (n/s/e/w) | Resize one axis only — the other stays fixed |

Zones cannot be resized below 2×2 grid cells (the same minimum as zone painting). During resize, the moving edge snaps to nearby objects when **Snap to Objects** is enabled, and guide lines appear at snap positions. The cursor changes to a directional resize arrow when hovering over a handle.

Resize is atomic — one drag produces one undo step. Press Escape during a resize drag to cancel without applying changes.

### Batch Operations

The Selection Actions panel also includes zone-specific batch operations when zones are in the selection: assign all to a district, add a tag, or delete selected zones.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Escape | Deselect all |
| Delete | Delete selected objects |
| Ctrl+A | Select all objects |
| Ctrl+D | Duplicate selection |
| Ctrl+K | Open search overlay |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Arrow keys | Nudge selected objects by 1 grid cell |
| Enter | Open details panel for selected object |
| P | Apply preset to selected district/zone |
| Shift+P | Save current selection as preset |
| Double-click | Select object and open its details panel |
| Double-right-click | Open Speed Panel (floating command palette at cursor) |

## 9. Presets

The **Presets** tab in the right sidebar provides a library of reusable templates for districts and encounters.

### Region Presets

Region presets configure an entire district in one click — tags, controlling faction, base metrics, economy profile, faction presences, and pressure hotspots. Four built-in presets are included:

| Preset | Tags | Faction | Key Metrics |
|--------|------|---------|-------------|
| Crypt District | dark, cramped, undead | undead-horde | Commerce 5, Safety 10 |
| Market Ward | bustling, trade, urban | merchant-guild | Commerce 90, Safety 55 |
| Chapel Grounds | sacred, order, stone | chapel-order | Commerce 15, Safety 70 |
| Smuggler Dock | shady, waterfront | smuggler-ring | Commerce 70, Safety 20 |

**Apply modes:**

- **Merge** — fills only empty or default fields, preserving existing customization
- **Overwrite** — replaces all preset-covered fields regardless of existing values

Both modes create a single undo step. Select a district, choose a preset, then click Apply (then Confirm).

### Encounter Presets

Encounter presets create a new encounter anchor with pre-configured settings. Three built-in presets:

| Preset | Type | Probability | Cooldown | Tags |
|--------|------|-------------|----------|------|
| Boss Encounter | boss | 1.0 | 0 turns | boss, scripted |
| Hazard Encounter | hazard | 0.6 | 2 turns | environmental, trap |
| Discovery Encounter | discovery | 0.4 | 5 turns | lore, reward |

Select a zone, choose a preset, click Apply to place the encounter.

### Custom Presets

Click **Save Current** to capture a selected district's configuration (or a selected encounter) as a custom preset. Custom presets support full editing and deletion. Built-in presets are immutable (shown with a lock icon) — duplicate them to customize.

Custom presets are stored in localStorage and persist across sessions.

## 10. Search

Press **Ctrl+K** anywhere in the editor to open the search overlay. Type to filter across all object types — zones, entities, landmarks, spawns, encounters, districts, connections, dialogues, progression trees, and presets.

Search matches against names, IDs, and contextual detail (e.g., an entity's zone or role, an encounter's type and probability, a preset's description). Results are capped at 20, keyboard-navigable with arrow keys, and pressing Enter selects the object and frames it on the canvas. For districts, all member zones are selected. For encounters, the parent zone is framed. For dialogues and progression trees, the corresponding sidebar tab opens. For presets, the Presets tab opens.

## 11. Speed Panel

**Double-right-click** anywhere on the canvas to open the Speed Panel — a floating command palette positioned at your cursor.

The Speed Panel is context-aware. Actions change based on what's under the cursor:

| Context | Available Actions |
|---------|-------------------|
| Empty canvas | New Zone, Fit to Content |
| Zone | Edit Properties, Delete, Duplicate, Assign District, Place Entity Here, Connect From Here |
| Entity | Edit Properties, Delete, Duplicate |
| Landmark | Edit Properties, Delete, Duplicate |
| Spawn | Edit Properties, Delete |
| Encounter | Edit Properties, Delete |
| Connection | Edit Properties, Delete, Swap Direction |

### Pinned Favorites

Click the star icon next to any action to pin it. Pinned actions always appear at the top of the Speed Panel in a dedicated section, regardless of context. Pins persist across sessions in localStorage.

### Search & Keyboard

Type in the search input to filter actions by name. Use **Arrow keys** to navigate, **Enter** to execute, and **Esc** to dismiss.

## 12. Objects Tab

The **Objects** tab in the right sidebar provides a hierarchical tree view of your entire project:

```
District A
  ├─ Zone: Chapel Entrance
  │    ├─ E: Guardian Spirit (npc)
  │    ├─ L: Altar of Passage
  │    └─ S: player-start (default)
  └─ Zone: Inner Sanctum
Unassigned
  └─ Zone: Hidden Passage
```

Click any item to select it on the canvas and frame it in view. The tree highlights the current canvas selection, and auto-scrolls to keep selected items visible. A filter input at the top narrows the tree by name or ID — matching propagates up, so a zone stays visible if any of its children match.

Click a district header to select all its zones. Double-click to expand or collapse.

## 13. Scene Preview

When you select a zone, the **Scene Preview** panel appears above the Zone Properties form. It shows an inline HTML/CSS composition of everything visually bound to that zone:

- **Background/tileset** — asset labels with `[background]`/`[tileset]` kind badges
- **Ambient layers** — color swatches with name, type, and intensity
- **Entities** — role-colored dots with name, portrait/sprite badges
- **Landmarks** — gold diamond markers with name and icon badge
- **Items** — rarity-colored squares with name, slot, and icon badge
- **Spawns** — green markers with default star indicator
- **Connections** — text summary of connected zone names with conditions
- **Light level** — sun icon with 0-10 readout

Missing assets show red `Missing: {id}` markers. The preview respects all layer toggle states — hiding entities in the Layers panel also hides them in the preview.

Click the **▾ Scene Preview** header to collapse/expand the panel.

### Layer Toggles

The **Layers** section in the tool palette provides 7 visibility toggles:

| Toggle | Canvas Effect | Preview Effect |
|--------|--------------|----------------|
| Grid | Grid lines on/off | — |
| Connections | Connection lines on/off | — |
| Entities | Entity circles on/off | Entity list on/off |
| Landmarks | Diamond markers on/off | Landmark list on/off |
| Spawns | Spawn squares on/off | Spawn list on/off |
| Backgrounds | — | Background/tileset badges on/off |
| Ambient | Zone tint overlays on/off | Ambient layer entries on/off |

## 14. Export

Click **Export** to validate your project and download the ContentPack. The export pipeline:

1. Runs `validateProject()` — catches orphan references, missing spawn points, broken dialogue links
2. Converts zones, districts, entities, items, and dialogues to engine format
3. Generates a manifest and pack metadata
4. Returns warnings for missing features (no landmarks, no faction presences, etc.)

The output is a set of JSON files ready to load into ai-rpg-engine.

If you imported the project, the export modal also shows a **Changes Since Import** section — a summary of what was modified, added, or removed since the original import, plus any fidelity caveats from the import process.

## 15. Import

Click **Import** to load a previously exported JSON file back into the editor. World Forge auto-detects the format:

- **WorldProject** — lossless, loads directly
- **ExportResult** — the `{ contentPack, manifest, packMeta }` output from export
- **ContentPack** — engine content without manifest wrapper

After import, the **Import** tab appears in the right sidebar showing a fidelity report — a domain-by-domain breakdown of what was lossless, what was approximated (e.g., zone grid positions), and what was dropped (e.g., visual layers). Each entry has a severity level and a human-readable explanation.

## 16. Track Changes

After importing a project, the **Diff** tab appears in the right sidebar. It shows a semantic diff between the imported snapshot and your current project state:

- **Modified** objects show field-level before/after values
- **Added** objects are highlighted in green
- **Removed** objects are highlighted in red

Changes are grouped by domain (Zones, Districts, Entities, Items, etc.) so you can see exactly what you've edited since import.
