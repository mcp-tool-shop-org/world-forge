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

## 5. Export

Click **Export** to validate your project and download the ContentPack. The export pipeline:

1. Runs `validateProject()` — catches orphan references, missing spawn points, broken dialogue links
2. Converts zones, districts, entities, items, and dialogues to engine format
3. Generates a manifest and pack metadata
4. Returns warnings for missing features (no landmarks, no faction presences, etc.)

The output is a set of JSON files ready to load into ai-rpg-engine.
