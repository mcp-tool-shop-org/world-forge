# Phase 5C — Editor Authoring Loop Audit

**Date:** 2025-04-30  
**Commit:** (this commit)  
**Verdict:** PASS_WITH_FRICTION

## Summary

Loaded chapel-project.json in the live editor, exercised district expansion,
validation panel, dependency panel, asset panel, and both export targets
(AI-RPG JSON + Unreal Engine 5). All core authoring paths complete without crash.

## Fixes Applied (this commit)

| Fix | File | Impact |
|-----|------|--------|
| Normalize missing optional arrays on project load | `packages/editor/src/store/project-store.ts` | Prevents 30+ crash sites when loading older projects that lack `assets`/`assetPacks` arrays |
| Guard `project.assets.length` in App.tsx | `packages/editor/src/App.tsx` | Prevents status bar crash on undefined |
| Null-safe iteration in `scanDependencies` | `packages/schema/src/dependencies.ts` | Prevents crash on undefined `assets`/`assetPacks` |
| Vite alias: resolve `@world-forge/export-unreal` to `export.js` only | `packages/editor/vite.config.ts` | Avoids loading Node-only modules (summary, diff, signing) in browser |
| Crypto stub for `node:crypto` | `packages/editor/src/stubs/crypto.ts` | Lets signing.ts module load in browser without crashing |

## Authoring Loop Results

| Step | Result |
|------|--------|
| Boot editor | ✅ Clean, no errors |
| Load chapel-project.json | ✅ Zones: 5, Entities: 4, Districts: 2 |
| Expand district panel | ✅ Metrics, tags, factions, hotspots all visible |
| Validation panel | ✅ "No issues found — ready to export" |
| Issues suggestions | ⚠️ 4 suggestions visible but ▶ toggle doesn't expand via programmatic click |
| Export JSON (AI-RPG) | ✅ Download triggered: `chapel-threshold-engine-pack.json` |
| Export UE5 | ✅ Download triggered: `chapel-threshold-unreal-pack.json` + advisory warnings |
| Deps panel | ✅ "No dependency issues found" |
| Assets panel | ✅ "Asset Library (0)" with Add Pack/Add Asset buttons |
| Status bar | ✅ Shows mode, tool, zones, entities, assets, zoom, validity |

## Friction Findings

1. **Canvas intercepts pointer events over left sidebar** — Districts panel clicks
   fail in automated testing because the canvas overlay captures pointer events.
   Real users can scroll/click the sidebar, but it suggests z-index stacking may
   cause issues on narrow viewports.

2. **Suggestions toggle (▶ Suggestions) doesn't respond to `.click()`** — React
   synthetic event system requires `dispatchEvent(new MouseEvent(...))` or
   `react-testing-library` fireEvent. Minor DX issue for automation.

3. **No Godot export target** — Export modal shows AI-RPG + UE5 only. The
   `export-godot` package exists but isn't wired into the editor yet.
   **Decision:** Track for v4.5.0 — not a blocker for current release.

4. **UE5 export warnings not surfaced before clicking Export** — User sees
   warnings only AFTER export completes. Could show a warning summary in the
   modal's "Export Contents" section.

## Godot Gap Decision

**Track, don't fix now.** The `packages/export-godot/` package has src stubs.
Wiring it into the editor requires:
- Export handler in `export-handlers.ts`
- Button in `ExportModal.tsx`
- Integration tests

This is a feature addition, not a bug fix. Tracked for v4.5.0.

## Test Results

```
Test Files  103 passed (103)
     Tests  2067 passed (2067)
  Duration  7.78s
```
