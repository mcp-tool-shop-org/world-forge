# World Forge Audit — PASS

**Date:** 2026-04-30  
**Repo:** mcp-tool-shop-org/world-forge  
**Version:** 4.4.0  
**Tests:** 2067/2067 passing  

## Positioning

World Forge exports one authored world to **AI RPG Engine**, **Godot 4**, and **Unreal Engine 5**, with proof that each target can consume the result.

## Evidence Chain

| Proof | Assertions | Commit | What it proves |
|-------|-----------|--------|----------------|
| Multi-target export | 23/23 | a6af84e | Single proof world exports to all three targets with structural invariants |
| Godot engine smoke | 13/13 | efa7384 | Godot 4.6 loads exported .tscn scenes and validates node trees |
| AI RPG runtime smoke | 15/15 | 9d6094e | @ai-rpg-engine runtime boots, validates refs, spawns player, traverses zones, ticks, serializes |
| Unreal importer smoke | 36/36 | 8c786af | UE5 DataAsset shape validated: coordinates, Y-axis, IDs, BP tags, streaming hints |

**Total: 87 runtime assertions across 4 proofs, all PASS.**

## Per-Target Detail

### AI RPG Engine

Pipeline: export → `loadContent()` → `validateRefs()` → `registerPack()` → `createTestEngine()` → player spawn → zone traversal → tick → serialize `{world, actionLog}`

Packages consumed: `@ai-rpg-engine/content-schema` ^2.0.1, `@ai-rpg-engine/core` ^2.0.1, `@ai-rpg-engine/pack-registry` ^2.0.2

### Godot 4

Pipeline: export → `.tscn` scene files → Godot 4.6 headless `--script` load → node tree assertions (entity nodes, transitions, zone metadata)

### Unreal Engine 5

Pipeline: export → `UnrealContentPack` JSON → structural validation (no Editor required)

Coordinate spot-checks:

| Zone | Grid | Elevation | → X cm | → Y cm | → Z cm |
|------|------|-----------|--------|--------|--------|
| cellar | 0,4 | -3m | 0 | -400 | -300 |
| market | 5,0 | 0m | 500 | 0 | 0 |
| alley | 11,2 | 0m | 1100 | -200 | 0 |

Transform law: `X = gridX × 100`, `Y = -(gridY × 100)`, `Z = elevation × 100`

## Proof World

**Dustwalk — Multi-Target Proof** (`proof-dustwalk`)

- 5 zones (tavern, market, cellar, alley, gate)
- 4 entities (merchant, thief, guard, beast)
- 4 connections (door, stairs, passage, road)
- 1 dialogue, 1 transition, 3 items, 2 districts

Single source of truth: `dogfood/worlds/multi-target-proof.ts`

## Audit Scope

- [x] Build clean (`tsc --build` zero errors)
- [x] Full test suite (2067 tests, vitest)
- [x] Export pipeline correctness (3 targets)
- [x] Target consumability (runtime/engine-level proof per target)
- [x] Reference integrity (cross-refs validated by engine validators)
- [x] Coordinate fidelity (axis mapping + scale verified numerically)

## Scripts

```bash
npx tsx dogfood/chapel-threshold.ts        # Multi-target export proof
npx tsx dogfood/run-ai-rpg-smoke.ts        # AI RPG runtime smoke
npx tsx dogfood/run-unreal-smoke.ts        # Unreal importer smoke
# Godot smoke requires Godot 4.6 on PATH:
godot_console --headless --path dogfood/godot-smoke --script smoke_load_world.gd
```
