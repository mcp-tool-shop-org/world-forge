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

## 3. Create Districts

Open the **District** panel. Create districts to group zones into logical regions — a chapel grounds, crypt depths, market quarter, etc.

District properties:

- **Zone membership** — which zones belong to this district
- **Controlling faction** — which faction holds this territory
- **Base metrics** — commerce, morale, safety, stability (0-100)
- **Economy profile** — supply categories and scarcity defaults

## 4. Place Entities

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

## 5. Manage Assets

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

## 6. Canvas Viewport

The canvas uses a real camera model with pan and zoom. All content is drawn in world coordinates and projected through a viewport transform.

### Navigation

| Action | Input |
|--------|-------|
| Pan | Spacebar + drag, or middle-mouse drag |
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

## 7. Selection & Editing

The canvas supports rich selection and spatial editing workflows for working with multiple objects at once.

### Selecting Objects

| Action | Input |
|--------|-------|
| Select one object | Click it |
| Add to selection | Shift + click |
| Box select | Click and drag a rectangle (select tool) |
| Select all | Ctrl+A |
| Deselect all | Escape |

Hit priority when clicking: spawns > landmarks > entities > zones. If objects overlap, repeated clicks at the same spot cycle through all hits — no need to move objects out of the way.

### Moving & Duplicating

Drag any selected object (or group) to reposition it. A 3px dead-zone prevents accidental moves. All moves are atomic — one undo step reverts the entire drag.

Press **Ctrl+D** to duplicate the current selection. Duplicates appear offset by 2 grid cells with remapped IDs, `(copy)` name suffixes, and preserved district membership. Connections between co-selected zones are duplicated; connections to non-selected zones are dropped. Duplicated spawns are always non-default.

### Batch Operations

When multiple zones are selected, the **Batch Zone Actions** panel appears with options to assign all selected zones to a district, apply tags, or delete them in one operation.

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

## 8. Search

Press **Ctrl+K** anywhere in the editor to open the search overlay. Type to filter across all object types — zones, entities, landmarks, spawns, districts, dialogues, and progression trees.

Search matches against names, IDs, and contextual detail (e.g., an entity's zone or role). Results are capped at 20, keyboard-navigable with arrow keys, and pressing Enter selects the object and frames it on the canvas. For districts, all member zones are selected. For dialogues and progression trees, the corresponding sidebar tab opens.

## 9. Objects Tab

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

## 10. Scene Preview

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

## 11. Export

Click **Export** to validate your project and download the ContentPack. The export pipeline:

1. Runs `validateProject()` — catches orphan references, missing spawn points, broken dialogue links
2. Converts zones, districts, entities, items, and dialogues to engine format
3. Generates a manifest and pack metadata
4. Returns warnings for missing features (no landmarks, no faction presences, etc.)

The output is a set of JSON files ready to load into ai-rpg-engine.

If you imported the project, the export modal also shows a **Changes Since Import** section — a summary of what was modified, added, or removed since the original import, plus any fidelity caveats from the import process.

## 12. Import

Click **Import** to load a previously exported JSON file back into the editor. World Forge auto-detects the format:

- **WorldProject** — lossless, loads directly
- **ExportResult** — the `{ contentPack, manifest, packMeta }` output from export
- **ContentPack** — engine content without manifest wrapper

After import, the **Import** tab appears in the right sidebar showing a fidelity report — a domain-by-domain breakdown of what was lossless, what was approximated (e.g., zone grid positions), and what was dropped (e.g., visual layers). Each entry has a severity level and a human-readable explanation.

## 13. Track Changes

After importing a project, the **Diff** tab appears in the right sidebar. It shows a semantic diff between the imported snapshot and your current project state:

- **Modified** objects show field-level before/after values
- **Added** objects are highlighted in green
- **Removed** objects are highlighted in red

Changes are grouped by domain (Zones, Districts, Entities, Items, etc.) so you can see exactly what you've edited since import.
