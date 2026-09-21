---
title: Authoring levers
description: Which knob changes the simulation, which knob only changes the drawing, and where Salt Road keeps each one.
sidebar:
  order: 1
---

A world you can play is three agreements that must not be converted into each other. Salt Road, the felt harbour, is the worked example. Turn one lever, export, and look. Turning two at once is how a person ends up drawn in a room the simulation says they are not in.

## The three grids

| Grid | Unit | Where you edit it | Does the simulation hash it? |
|---|---|---|---|
| Occupancy | zone id | `zones`, `entityPlacements`, entry gates | Yes. This is who is where, and whether the door opened. |
| Cartesian | `gridX` / `gridY`, tile 32, then ×3 at 48 in the sandbox | the editor canvas and the Godot `.tscn` | No. |
| Dimetric | 256×128 diamond, `span` 3 | `WorldProject.presentation` | No. The stage draws this and never sends it back. |

`scaleForSandbox` multiplies cartesian geometry and skips `presentation` by name. A cell in `presentation` is copied, not computed from `gridX` / `gridY`.

## Levers, and the repo that hears them

| You want | Lever | Heard by |
|---|---|---|
| Another room | a zone, its neighbours, its prose | engine, joined to a scene node by zone id |
| A door that explains itself | `entryGate` conditions, `hard` or `soft`, and `reason` | engine refuses; stage only displays the reason |
| A person in a room | `entityPlacements[].zoneId` | engine. Hashed. |
| Where that person *stands* on the diamond | `presentation.occupancy[].cell` and `facing` | stage. Not hashed. Must sit inside that zone's `span` box, and the zone must match the placement. |
| Wet stone, dirt, dry stone | `presentation.floor` plate id (`stone_wet`, `stone_a`, `dirt_a`, `dirt_b`) | stage atlas. Absent `floor` still wets the long quay. |
| The anchor of a zone on the map | `presentation.zoneCells` | stage. |
| A thing in someone's inventory | engine `itemPlacements` of `{ itemId, entityId }` | engine. A zone-standing prop is not this. The guild seal on the counting-house floor is a stage marker, not a give-item. |
| What the player hears | cue id on the felt payload, file `assets/felt/<cueId>.wav` in the stage | stage mixer. Missing file is a sine stand-in. The cue id is never hashed. |

`presentation` is not a field on the engine `ContentPack`. The stage fixture writes it onto `pack.json`. The sidecar file keeps only the keys engine 3.12.0 loads.

## Salt Road, one change at a time

The authored world is `dogfood/worlds/salt-road.ts`. Export both lanes from one command:

```bash
npx tsx dogfood/export-stage-fixture.ts \
  --world=salt-road \
  --out=<ai-rpg-stage>/fixtures \
  --doctor \
  --strict \
  --engine-out=dogfood/output/salt-road/pack.json
```

`--strict` refuses to write when a presentation advisory fires (a cell outside its zone, a person drawn in the wrong room, no `player` row). The scene it writes is a **join graph**: zone nodes and gate text, and no play pawn. A full Godot project export still emits `CharacterBody2D` and `world_data`; the stage project cannot instance those paths.

Play from the stage checkout with `node tools/play.mjs`. The sidecar is TCP `--listen`, with `fixtures/salt-road.manifest.json` beside the engine pack.

## Where the rest of the book is

- Types and the eight presentation advisories: [Schema & Types](./schema/).
- What the Godot exporter keeps, approximates, and drops: [Godot Export](./export-godot/).
- What the engine actually loads: [Engine Export](./export/).
- How the client draws a lever you already set: the stage handbook's authoring levers, and the engine's [Visual Clients](https://mcp-tool-shop-org.github.io/ai-rpg-engine/handbook/66-visual-clients/).
