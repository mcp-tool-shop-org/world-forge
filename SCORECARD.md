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
