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

## 6. Export

Click **Export** to validate your project and download the ContentPack. The export pipeline:

1. Runs `validateProject()` — catches orphan references, missing spawn points, broken dialogue links
2. Converts zones, districts, entities, items, and dialogues to engine format
3. Generates a manifest and pack metadata
4. Returns warnings for missing features (no landmarks, no faction presences, etc.)

The output is a set of JSON files ready to load into ai-rpg-engine.

If you imported the project, the export modal also shows a **Changes Since Import** section — a summary of what was modified, added, or removed since the original import, plus any fidelity caveats from the import process.

## 7. Import

Click **Import** to load a previously exported JSON file back into the editor. World Forge auto-detects the format:

- **WorldProject** — lossless, loads directly
- **ExportResult** — the `{ contentPack, manifest, packMeta }` output from export
- **ContentPack** — engine content without manifest wrapper

After import, the **Import** tab appears in the right sidebar showing a fidelity report — a domain-by-domain breakdown of what was lossless, what was approximated (e.g., zone grid positions), and what was dropped (e.g., visual layers). Each entry has a severity level and a human-readable explanation.

## 8. Track Changes

After importing a project, the **Diff** tab appears in the right sidebar. It shows a semantic diff between the imported snapshot and your current project state:

- **Modified** objects show field-level before/after values
- **Added** objects are highlighted in green
- **Removed** objects are highlighted in red

Changes are grouped by domain (Zones, Districts, Entities, Items, etc.) so you can see exactly what you've edited since import.
