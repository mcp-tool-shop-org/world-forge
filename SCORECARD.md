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
