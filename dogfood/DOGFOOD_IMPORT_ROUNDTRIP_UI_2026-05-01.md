# Phase 8 — Import / Round-Trip UI Audit

**Date:** 2026-05-01  
**Commit:** c610be1  
**Verdict:** PASS (after fix)

## Test Procedure

1. Load Chapel Threshold project (5 zones, 2 districts, 4 entities, 3 items, 1 dialogue, 1 spawn, 4 connections)
2. Export as AI RPG JSON via Export modal → 20KB ExportResult
3. Import the exported JSON via Import modal
4. Verify Import Summary panel fidelity report
5. Verify Diff panel shows no spurious changes

## Baseline Counts

| Domain | Original | After Import |
|--------|----------|--------------|
| Zones | 5 | 5 ✓ |
| Districts | 2 | 2 ✓ |
| Entities | 4 | 4 ✓ |
| Items | 3 | 3 ✓ |
| Dialogues | 1 | 1 ✓ |
| Prog. Trees | 2 | 2 ✓ |
| Spawns | 1 | 1 ✓ |
| Connections | 4 | 4 (reconstructed from neighbor data) ✓ |

## Bug Found & Fixed

**Crash:** `scanDependencies` in `@world-forge/schema` threw
`TypeError: Cannot read properties of undefined (reading 'map')` when
the DependencyPanel's `useDependencyCount` hook fired after importing
an ExportResult-format project.

**Root cause:** `scanDependencies` and `collectReferencedAssetIds`
accessed `project.zones`, `project.dialogues`, `project.entityPlacements`,
`project.itemPlacements`, `project.landmarks`, `project.connections`,
`project.districts`, `project.spawnPoints`, and `project.encounterAnchors`
without `?? []` fallbacks — unlike `project.assets` and `project.assetPacks`
which already had them.

**Fix:** Added `?? []` to all bare array accesses in both functions (c610be1).

## Import Summary Panel

- Format badge: "ExportResult (lossy)" ✓
- Overall fidelity bar: 3% lossless (36 entries: 1 lossless, 29 approximated, 6 dropped)
- Domains displayed: Zones (14), Districts (4), Entities (8), Items (4), Build Catalog (1), World (3), Assets (1), Packs (1)
- Repair hints displayed for all warning/error entries ✓
- Human-readable labels, not raw JSON ✓
- Collapsible domain groups ✓

## Diff Panel

- Shows "No changes since import" immediately after import ✓
- Lists all domains (Zones, Districts, Entities, Items, Dialogues, Progression Trees, Player Template, Build Catalog) ✓
- Each domain shows "no changes" ✓
- No noisy JSON churn ✓

## Known Lossy Aspects (Expected)

- Zone grid positions auto-generated (layout lost in export)
- Entity zone assignments reconstructed via round-robin
- Item placements all assigned to first zone
- Visual layers (tilesets, props, ambient) dropped
- Asset manifest not available in ContentPack format
- District economy profiles defaulted to empty

These are documented lossy transformations inherent to the ExportResult format and are correctly surfaced in the Import Summary panel with repair hints.

## Test Results

All 2067 vitest tests pass after the fix.
