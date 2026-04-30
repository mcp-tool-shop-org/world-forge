# World Forge Audit — PASS

**Date:** 2026-04-30  
**Repo:** mcp-tool-shop-org/world-forge  
**Version:** 4.4.0  
**Tests:** 2067/2067 passing  
**Final commit:** 9f71fda  

## Positioning

World Forge can author/load a world in the browser editor, validate it, surface advisories, and export to AI RPG Engine, Godot 4, and Unreal Engine 5, with target-consumability proofs for each export lane.

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

## Editor Authoring Track

| Domain | Verdict |
|--------|---------|
| Editor browser boot | PASS |
| Editor authoring loop | PASS |
| Editor export UI parity | PASS |
| Friction burn-down | COMPLETE |

### Editor Proof

**Chapel Threshold** loaded in the browser editor (localhost:5200), validated clean, exported to all three targets via the Export modal UI without crashes or error boundaries.

| Export Target | UI Button | Artifact | Status |
|--------------|-----------|----------|--------|
| AI RPG Engine | Export JSON | `chapel-threshold-engine-pack.json` | ✓ Downloaded |
| Unreal Engine 5 | Export Unreal Engine 5 | `chapel-threshold-unreal-pack.json` | ✓ Downloaded |
| Godot 4 | Export Godot 4 | `chapel-threshold-godot-pack.json` | ✓ Downloaded |

### Editor Phase History

| Phase | Verdict | What happened |
|-------|---------|---------------|
| 5A | BLOCKED | `node:module` + `node:crypto` crash the browser |
| 5B | PASS | Removed node:* boundary violations (657e234) |
| 5C | PASS_WITH_FRICTION | Sidebar click interception, missing Godot UI |
| 5D | COMPLETE | z-index fix, Godot button, pre-export advisories, a11y (9f71fda) |
| 5E | PASS | Full re-run: load → validate → export ×3 → no crashes |

### Key Editor Fixes

1. `node:module` → replaced `createRequire` with `SCHEMA_VERSION` constant
2. `node:crypto` → Vite alias to browser stub + lazy import
3. Canvas/sidebar z-index → sidebars get `position:relative; z-index:1; flex-shrink:0`
4. Godot 4 export → full UI button + handler pipeline + Vite alias
5. Pre-export advisories → elevation/parallax/entity/connection warnings shown before export
6. Suggestions toggle → `<div onClick>` → `<button data-testid="wf-suggestions-toggle">`

### Commit Trail

```
9f71fda feat(editor): Phase 5D friction burn-down — z-index, Godot export, advisories, a11y
08ee24d fix(editor): normalize optional arrays on project load + UE5 export browser compat
657e234 fix: remove node:* runtime-boundary violations that crash the editor
```
