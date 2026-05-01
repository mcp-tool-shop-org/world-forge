# Scorecard

> **Release:** v4.0.3  
> **Repo:** world-forge  
> **Date:** 2026-03-11  
> **Type tags:** `[npm]` `[cli]`

## Assessment

| Category | Score | Notes |
|----------|-------|-------|
| A. Security | 10/10 | SECURITY.md, threat model, no secrets, no telemetry |
| B. Error Handling | 9/10 | Typed validation results, CLI exit codes, no raw stacks. ErrorBoundary on Canvas. |
| C. Operator Docs | 10/10 | README current, CHANGELOG up to date (4.0.3), LICENSE present, `--help` accurate, DESIGN-SYSTEM.md for editor contributors |
| D. Shipping Hygiene | 10/10 | verify script, version/tag match, npm audit in CI, engines.node set, lockfile committed |
| E. Identity (soft) | 8/10 | Logo in README. No landing page or translations (internal tool — acceptable skip). |
| **Overall** | **47/50** | |

## Remaining Edges

1. **ExportModal** — not yet migrated to ModalFrame (intentionally deferred, non-standard layout). Known special case, not hidden debt.
2. **shared.tsx legacy exports** — `sectionTitle`, `addBtnStyle`, `smallBtnStyle`, `xBtnStyle`, `itemStyle`, `hintStyle`, `deleteBtnStyle` still imported by 14+ files. Internals now use CSS variables, but the export surface could consolidate into `styles.ts` in a future pass.
3. **SpeedPanel / SearchOverlay** — extensive inline styles not yet tokenized. Lower priority (floating panels with complex positional logic).

## What Shipped in This Release

- Design-system token layer (theme.css + styles.ts + ModalFrame)
- Modal migration (6/7 modals)
- Control standardization (14 files)
- Panel shell tokenization (shared.tsx, App.tsx, ChecklistPanel)
- Audit follow-up hardening (result discriminants, ErrorBoundary, CLI tests, viewport tests, shape guards)
- CI fix (secrets context in step-level if)
- Multilingual READMEs (7 languages)

## Test Integrity

- **57 test files, 1,268 tests, 0 failures**
- Build: clean (tsc --build, zero errors)
- All 4 packages published to npm at 4.0.3

---

## Phase 14 — Error Envelope / Diagnostics Audit

**Verdict: PASS**

### Audit Findings & Fixes

| Area | Before | After | Breaking? |
|------|--------|-------|-----------|
| Unreal import errors | `errors: string[]` (no path/location) | `errors: ValidationError[]` with `path: 'Meta.FormatVersion'` | Yes (minor — internal consumers only) |
| AI RPG import errors | `message: string` only | Added `errors: ValidationError[]` alongside `message` | No (additive) |
| Unreal CLI fatal handler | No stack trace on crash | Prints `err.stack` when `--verbose` is passed | No |
| SHIP_GATE.md | Referenced `--debug` flag | Corrected to `--verbose` | N/A (docs) |

### Consistency Assessment

| Dimension | Status |
|-----------|--------|
| Export errors (all 3 targets) | Consistent: `{ success: false, errors: ValidationError[] }` |
| Import errors | Now unified: both packages return `errors: ValidationError[]` |
| CLI error formatting | Both CLIs use `[path] message` for validation, `Fatal:` for uncaught |
| CLI exit codes | Both: 0=ok, 1=error |
| CLI verbose mode | Both: `--verbose` prints stack trace on Fatal |
| Editor ErrorBoundary | Excellent: structured JSON copy, DEV-only stacks, retry/reload |
| Dependency scanner | Fully structured: `DependencyEdge` with domain/status/source/target/message |
| Fidelity reports | Consistent across all exporters: `FidelityEntry[]` with level/domain/severity |
| Advisory/Validation | Well-structured: `AdvisoryItem[]`, `ValidationError[]` |

### Accepted Drift (not fixed)

1. **Discriminant naming** — Schema uses `valid`, exporters use `success`, editor internals use `ok`. These are semantically distinct (`valid` = "is it correct?", `success` = "did the operation work?", `ok` = internal parse). Renaming would be churn with no user benefit.
2. **Editor `ParseProjectError.error` (singular string)** — Internal to the editor, not published. The ImportModal correctly handles both `ok`/`success` shapes. No external consumer confusion.

### Test Results

- 2082 tests passing (0 failures)
- TypeScript: 0 errors
- All changes backward compatible except `UnrealImportError.errors` type upgrade (internal)

---

## Phase 15 — Backward Compatibility / Migration Audit

**Verdict: PASS**

### Crash Risks Found & Fixed

| # | Package | Crash scenario | Fix |
|---|---------|----------------|-----|
| 1 | export-ai-rpg | `importFromContentPack` crashes on old packs missing `dialogues` or `progressionTrees` (`undefined.map()`) | Added `?? []` guards at call sites |
| 2 | export-unreal | `deserializeV1` crashes on pre-WorldPartition packs (`pack.WorldPartition.SourceMode` TypeError) | Extracted `wp` guard with fidelity warning + defaults |
| 3 | export-unreal | `deserializeV1` crashes on packs missing `Zones`, `Districts`, `Actors`, or `Connections` | Added `?? []` and `?.` guards on all array accesses |
| 4 | editor | `loadProject` only guards `assets`/`assetPacks` — old JSON missing `dialogues`, `progressionTrees`, `landmarks`, `lootTables`, `transitions` stays `undefined` in store | Expanded `?? []` guards to cover all additive arrays |

### Already Safe Areas

| Area | Why safe |
|------|----------|
| `advisory.ts` | All 7 array accesses use `?? []` |
| `dependencies.ts` | 17 separate `?? []` guards on every iterated array |
| `importFromExportResult` | Guards `packMeta`, `assets`, `assetBindings`, `assetPacks` with optional chaining |
| Export pipelines (all 3) | Gated by `validateProject()` which rejects before access |
| `lootTables` / `transitions` | `?` in type + `?? []` in validator |
| Unreal migrations | `1.0.0 → 1.1.0` edge exists; missing `FormatVersion` falls through to V1 |
| Pre-versioning Unreal packs | `parseSemVer` returns null → V1 deserializer (no crash) |

### Accepted Gaps (not actionable)

1. **Validator rejects projects missing required arrays** — `validateProject()` returns `valid: false` for projects without `dialogues`, `progressionTrees`, `assets`, `assetPacks` etc. This is correct behavior (the validator's job is to enforce the current schema). Old projects will fail validation with a clear error message, not crash.
2. **No `@deprecated` annotations exist anywhere** — nothing to migrate away from.
3. **Deep imports blocked by exports maps** — consumers using `@world-forge/export-ai-rpg/dist/import.js` will break. This is intentional (Phase 13) and documented.

### Regression Tests Added

- AI RPG: old ContentPack missing `dialogues`/`progressionTrees` imports cleanly
- Unreal: pack missing `WorldPartition` imports with fidelity warning + 1×1 default grid
- Unreal: pack missing `Actors` imports with empty `entityPlacements`

### Test Results

- 2085 tests passing (0 failures, +3 new)
- TypeScript: 0 errors

---

## Phase 16 — Asset Pipeline / Binding Audit

**Verdict: PASS**

### Pipeline Traced

```
AssetEntry/AssetPack (schema) → zone/entity/item/landmark refs → editor AssetPanel
  → export binding collection → AI RPG/Godot/Unreal output → import recovery → fidelity
```

### Bugs Found & Fixed

| # | Component | Bug | Impact | Fix |
|---|-----------|-----|--------|-----|
| 1 | Editor `AssetPanel.tsx` | Orphan detection misses `skylineRef` and `parallaxLayers[].assetRef` | 2.5D assets falsely shown as "unused" | Added skyline/parallax to `referencedIds` collection |
| 2 | Editor `export-handlers.ts` | `runEngineExport` drops `assets`, `assetBindings`, `assetPacks` from download bundle | Round-trip through editor download is lossy for assets even though exporter collects them | Forward all three fields to the bundle |
| 3 | Editor `export-handlers.ts` | AI RPG fidelity report hardcoded as `{ level: 'preserved', warnings }` | Real `FidelityReport` (entries + summary) lost; receipt always says "preserved" | Use `result.fidelity` and compute receipt level from summary |
| 4 | Editor `export-handlers.ts` | `ExportReceipt` has no `assets` count | All 3 receipts silently omit asset count | Added `assets: number` to type; populated in all handlers; rendered in `ExportModal` |

### Already Strong Areas

| Area | Status |
|------|--------|
| Schema validation (rules 41-55) | Thorough: asset ref kind checks, orphan detection (with skyline/parallax), pack validation, semver, parallax depth/scrollFactor |
| `dependencies.ts` | Complete: `collectReferencedAssetIds` includes skyline + parallax. All 17 ref-extraction guards use `?? []` |
| AI RPG export bindings | Deterministic: sorted keys (AIR-B-001), alphabetical top-level order, byte-identical across runs |
| AI RPG import recovery | `importFromExportResult` recovers assets + bindings + packs with fidelity entries |
| ContentPack import (lossy) | Correctly produces `assets-dropped` fidelity warning |
| Godot `convert-assets.ts` | Kind-based directory mapping, per-asset fidelity entry, packId preserved |
| Unreal export | Assets intentionally not in `UnrealContentPack` (UE5 manages its own asset pipeline). Entity `PortraitAssetId`/`SpriteAssetId` DO survive as actor metadata |

### Accepted Design Decisions

1. **AI RPG `AssetBindingMap` omits `skylineRef`/`parallaxLayers`** — AI RPG is a text engine; 2.5D visual refs are correctly dropped with existing fidelity warnings.
2. **Godot export has no `assetPacks` metadata** — Pack membership survives via `GodotAssetBinding.packId`, but pack-level metadata (label, version, etc.) is lost. Godot is a one-way export; no import path exists. Not worth adding a format field for.
3. **Unreal export has no asset manifest** — By design. UE5 manages assets through its own pipeline. Actor entries carry `PortraitAssetId`/`SpriteAssetId` for binding hints.

### Regression Tests Added

- AI RPG bundle includes `assets`/`assetBindings`/`assetPacks` when project has them
- Export receipt includes `assets` count
- Receipt fidelity computed from real report, not hardcoded

### Test Results

- 2088 tests passing (0 failures, +3 new)
- TypeScript: 0 errors

---

## Phase 17 — Persistence / Local Save Audit

**Verdict: PASS**

### Bugs Found & Fixed

| # | Component | Bug | Impact | Fix |
|---|-----------|-----|--------|-----|
| 1 | `App.tsx` | `startAutoSave()` never called | Autosave system was fully implemented + tested in isolation but dead in production — users lose all work on crash/tab close | Added `useEffect` that calls `startAutoSave()` on mount with cleanup via `stopAutoSave()` |
| 2 | `App.tsx` | No crash recovery prompt on mount | Even if autosave had been running, the recovered project was never offered to the user | Added `hasAutoSaveRecovery()` check on mount → `loadProject(recovered)` + toast |
| 3 | `App.tsx` | `handleSave` never resets `dirty` flag | After saving, the unsaved-changes dot persists and `beforeunload` still warns the user | Added `markClean()` call after the download triggers |
| 4 | `project-store.ts` | No `markClean` action existed | `dirty` could only be cleared by `loadProject` or `newProject`, both of which destroy undo history | Added `markClean()` that sets `dirty: false` without clearing undo/redo stacks |

### Persistence Architecture (verified)

| Mechanism | Storage | What persists | Status |
|-----------|---------|---------------|--------|
| Manual Save (File → Save) | Download `.json` file | Full `WorldProject` | **Fixed** (now clears dirty) |
| Manual Load (File → Load) | Upload `.json` file | Full `WorldProject` | OK — `loadProject` with `?? []` guards |
| Autosave (30s interval) | `localStorage` `wf-autosave` | Full `WorldProject` + timestamp | **Fixed** (now actually runs) |
| Autosave History | `localStorage` `wf-autosave-history` | Last 3 snapshots | OK — transactional writes, rollback on failure |
| Crash Recovery | `localStorage` → mount check | Most recent autosave | **Fixed** (now checks + restores) |
| Oversize Guard | In-memory flag | Projects >4.5 MB skip autosave | OK — banner warns user, suggests Export Bundle |
| Kits | `localStorage` `world-forge-kits` | User-created kits (not built-ins) | OK — `persist()` on every CRUD |
| Presets | `localStorage` `world-forge-presets` | User region + encounter presets | OK — `persistUserPresets()` on every CRUD |
| Templates | `localStorage` `world-forge-templates` | Saved-as-template projects | OK — `persist()` on every CRUD |
| Theme | `localStorage` `wf-theme` | `'dark'` / `'light'` | OK |
| Elevation toggle | `localStorage` `wf-show-elevation` | Boolean | OK |
| Hidden IDs | `localStorage` `wf-hidden-ids` | Per-object visibility | OK — one-time warn flag on write failure |
| Export Bundle | Download `.json` | ContentPack + manifest + fidelity | OK |
| Import | Upload `.json` | WorldProject / ContentPack / ExportResult | OK |
| beforeunload | Browser event | Prevents accidental close when dirty | OK — now correctly reflects save state |

### Already Strong Areas

| Area | Why |
|------|-----|
| Autosave implementation | Transactional dual-key writes, rollback on partial failure, quota-exceeded handling, oversize guard with banner, 30s interval, idempotent start/stop |
| Undo/Redo | 100-deep stack, labeled entries, correctly marks dirty on both directions |
| Corrupted data handling | All `loadFromStorage()` callers catch JSON parse errors and reset gracefully |
| Large project guard | `AUTOSAVE_MAX_BYTES` (4.5 MB) prevents silent write failures from hitting browser quota |
| Error boundary | Reads `wf-autosave` for project ID in crash report, warns when localStorage is unavailable |

### Regression Tests Added

- `markClean` sets dirty to false without clearing undo stack
- Editing after `markClean` makes dirty again

### Test Results

- 2090 tests passing (0 failures, +2 new)
- TypeScript: 0 errors
