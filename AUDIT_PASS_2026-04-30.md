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

## Phase 6 — Release Readiness

**Verdict: PASS**

- README: removed all "(planned)" Godot language — now accurately describes 6 shipping packages + 3 export targets
- Versions: all packages aligned at 4.4.0 (export-godot was 1.0.0)
- Package contents: `!dist/__tests__` excludes test files from npm tarballs
- Install path verified: `npm install && npm run build && npm test` all green
- CLI truth: `world-forge-export` and `world-forge-export-unreal` both work as documented
- export-godot README rewritten (was "stub — do not install")

## Phase 7 — Automated Browser Regression

**Verdict: PASS**

6 Playwright e2e tests lock in Phase 5E verification:
- Editor boots, project loads, Issues tab opens, suggestions toggle is `<button>`, Export modal shows 3 target buttons, advisories render.

Run: `npm run test:e2e`

## Phase 8 — Import / Round-Trip UI

**Verdict: PASS** (after fix)

Round-trip test: Load Chapel Threshold → Export AI RPG JSON → Import exported file → Verify fidelity report + diff panel.

**Bug found:** `scanDependencies` in `@world-forge/schema` crashed with `TypeError: Cannot read properties of undefined (reading 'map')` during import. Bare array accesses lacked `?? []` fallbacks. Fixed in c610be1.

**After fix:**
- All counts survive round-trip: 5 zones, 2 districts, 4 entities, 3 items, 1 dialogue, 2 trees
- Import Summary panel displays 36 fidelity entries across 8 domains with repair hints
- Diff panel shows "No changes since import" — no noisy JSON churn
- No crash from missing optional arrays or asset fields

Artifact: `dogfood/DOGFOOD_IMPORT_ROUNDTRIP_UI_2026-05-01.md`

## Phase 9 — Sample / Template Quality

**Verdict: PASS**

All 21 templates/kits/samples validate clean and export to all three targets without errors.

| Category | Count | Content | Verdict |
|----------|-------|---------|---------|
| Genre templates | 5 (Fantasy, Cyberpunk, Detective, Pirate, Zombie) | 4z/2e/2i/1d/1t each | REAL |
| Starter kits | 7 (one per mode) | 4z/2e/2i/1d/1t each | REAL |
| Samples (minimal) | 1 (Hello World) | 1z only | INTENTIONAL |
| Samples (intermediate) | 6 | 2-4z/2e/2i/1d/1t | REAL |
| Samples (rich) | 2 (Chapel Threshold, Tavern) | 5z/4e/3i/1d/2t | REAL |

**First-run UX verified in browser:**
- New Project wizard → 4 tabs (Genres, Starter Kits, Samples, My Templates)
- 7 scale modes with descriptions, 5 genre templates with icons
- Step 2 includes system checkboxes (player, builds, trees, dialogue, NPCs)
- Created Cyberpunk project → 4 zones, District mode, guide shows 6/8 steps done
- Export modal → "Ready to export — no issues found" → all 3 targets available

**Tone mapping note:** The exporter has a fixed valid-tone vocabulary (dark, gritty, heroic, noir, comedic, eerie, tense, atmospheric). Templates using mode-specific tones (e.g. 'neon', 'maritime', 'survival') fall back gracefully to 'atmospheric' during export. Not a bug — documented lossy transform.

**No broken, thin, or misleading templates found.**

## Phase 10 — Editor Export Depth

**Verdict: PASS**

Turn three download buttons into a target-aware export control surface.

### 10A — Export Receipts

Post-download receipt stack in the Export modal showing target, size, filename, asset/entity counts, and fidelity-report summary. Receipts accumulate within the modal session.

### 10C — Per-target Readiness

Pre-export readiness badges (✓ Ready / ⚠ Ready with N advisories) for each target. Advisories surface missing elevation, parallax, entities, and connections before the user commits to an export.

### 10B — Per-target Options

Collapsible "Target Options" panel with engine-specific controls:

| Target | Options |
|--------|---------|
| AI RPG | Include fidelity report, include build catalog, include dialogue/progression |
| UE5 | Tile size (cm), blueprint path prefix, streaming hints toggle, signing note |
| Godot 4 | Entity scene prefix, transition scene prefix, include world .tscn, asset binding mode (manifest/manual) |

Options wire through to export handlers — AI RPG toggles filter bundle content, UE5/Godot settings embed in the downloaded bundle for downstream tooling.

### 10E — Regression Tests

15 new tests in `export-depth-regression.test.ts`:
- Receipt generation for all 3 targets
- Options wire-through to bundle content (catalog exclusion, dialogue exclusion, fidelity inclusion)
- UE5/Godot exportSettings embedding verification
- Default options produce identical output to no-options path
- Pre-export advisory computation

### Commits

```
08eb1fc feat(editor): Phase 10A+10C — export receipts + per-target readiness
f3a929c feat(editor): Phase 10B+10E — per-target export options + regression tests
```

### Test Count

**2082/2082 passing** (15 new regression tests)

