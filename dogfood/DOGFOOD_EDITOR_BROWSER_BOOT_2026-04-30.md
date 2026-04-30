# Phase 5B — Browser Boot Gate

**Date:** 2026-04-30  
**Verdict: PASS**  
**Editor version:** 4.4.0 (Vite 6.4.1 dev server)

---

## Summary

The editor now boots cleanly at `http://localhost:5199/` with no `node:*` externalization errors. All panels render, the export modal opens with both AI-RPG and Unreal Engine 5 targets, and the validation panel surfaces live issues.

---

## Fixes Applied

### 1. `packages/export-ai-rpg/src/export.ts` — remove `node:module`

**Before:** Used `createRequire(import.meta.url)` to read `@world-forge/schema/package.json` at runtime for the schema version.

**After:** Imports `SCHEMA_VERSION` directly from `@world-forge/schema` — a browser-safe constant that's always in sync with the linked schema.

### 2. `packages/editor/src/panels/export-handlers.ts` — dynamic imports

**Before:** Static top-level `import { exportToEngine }` and `import { exportToUnreal }` pulled the entire export barrels (including `node:crypto`, `node:fs/promises`, etc.) into the browser bundle at page load.

**After:** Both imports are now `await import(...)` inside the handler functions. The export packages are only loaded when the user clicks Export — never at page startup. The functions are now `async` (fire-and-forget from the React layer via `void`).

### 3. Test updates

- `export-modal.test.ts` — all `runEngineExport`/`runUnrealExport` calls now `await`ed
- `ed-b-humanization.test.ts` — same treatment

---

## Verification Evidence

| Check | Result |
|-------|--------|
| `npx tsc --build --force` | Clean (no output) |
| `npx vitest run` | 103 files, **2067 tests passed** |
| Editor loads at localhost:5199 | ✅ Full UI renders |
| No `node:*` console errors | ✅ None |
| Export modal opens | ✅ Shows AI-RPG + Unreal targets |
| Validation panel shows issues | ✅ "At least one spawn point is required" |
| Godot export in UI | ❌ Not wired — `export-godot` exists as a package but has no editor integration |
| Status bar | ✅ Mode, Tool, Zones, Entities, Assets, Zoom, issue count |

---

## Editor Surface Confirmed Running

- Toolbar: New, Import, Load, Save, Save as Template, Save as Kit, Undo, Redo, Export
- Tools: Select, Zone, Connect, Entity, Landmark, Spawn
- Layers: Grid, Connections, Entities, Landmarks, Spawns, Backgrounds, Ambient, Minimap, Elevation, Snap, Perf Stats, Diagnostics
- Right panels: Map, Player, Builds, Trees, Dialogue, Objects, Presets, Assets, Issues, Deps, Review, Guide
- Mode: Dungeon (with mode profile selector)
- Theme toggle (dark/light)
- Search overlay (Ctrl+K)

---

## Godot Export — Not in UI

The `@world-forge/export-godot` package exists in the monorepo but is not imported or surfaced anywhere in the editor. This is not a regression — it was never wired. Noted as a future integration task, not a Phase 5B blocker.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/export-ai-rpg/src/export.ts` | Remove `node:module`, use `SCHEMA_VERSION` constant |
| `packages/editor/src/panels/export-handlers.ts` | Static → dynamic `import()` for export packages |
| `packages/editor/src/panels/ExportModal.tsx` | Add `void` prefix to async handler calls |
| `packages/editor/src/__tests__/export-modal.test.ts` | Add `await` to async handler calls |
| `packages/editor/src/__tests__/ed-b-humanization.test.ts` | Add `await` to async handler calls |
