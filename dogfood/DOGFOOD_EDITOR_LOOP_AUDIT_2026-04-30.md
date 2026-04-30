# Phase 5A — Editor Loop Audit

**Date:** 2026-04-30  
**Verdict: BLOCKED**  
**Reason:** Editor crashes on load — cannot author worlds in the browser.

---

## Finding: Editor Does Not Start

Running `npx vite` in `packages/editor` and opening `http://localhost:5199/` produces a blank dark screen. The browser console throws:

```
Error: Module "node:module" has been externalized for browser compatibility.
Cannot access "node:module.createRequire" in client code.
```

**Source:** `packages/export-ai-rpg/dist/export.js:42` — uses `createRequire(import.meta.url)` to read `@world-forge/schema/package.json` at runtime (AIR-FT-005).

After patching that (experimentally), a second crash:

```
Error: Module "node:crypto" has been externalized for browser compatibility.
Cannot access "node:crypto.createHash" in client code.
```

**Source:** `packages/export-unreal/dist/signing.js:23` — imports `createHash` from `node:crypto` at module level (UE-FT-007).

Both are pulled into the browser because `packages/editor/src/panels/export-handlers.ts` directly imports `@world-forge/export-ai-rpg` and `@world-forge/export-unreal`, whose barrel exports eagerly load Node-only modules.

---

## Root Cause

The editor Vite config (`packages/editor/vite.config.ts`) has no special handling:

```ts
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
});
```

No `resolve.alias`, no `ssr.external`, no polyfills — so Vite externalizes all `node:*` built-ins for browser compatibility, then the code crashes when it tries to use them.

---

## Impact

Since the editor cannot render, **none of the Phase 5A authoring loop steps are testable:**

| Step | Status |
|------|--------|
| Open editor | BLOCKED |
| Create 5-zone world | BLOCKED |
| Place entities/items/spawns | BLOCKED |
| Create connections | BLOCKED |
| Trigger validation issue | BLOCKED |
| Fix validation issue | BLOCKED |
| Preview scenes | BLOCKED |
| Export all targets | BLOCKED |

---

## Code Audit (Static Review)

Even without running the editor, the codebase shows a mature authoring surface:

### Positive Signals

| Capability | Evidence |
|------------|----------|
| Undo/redo | `project-store.ts` — full snapshot undo with labels, `getUndoLabel()`/`getRedoLabel()` |
| Selection | Multi-select across zones/entities/landmarks/spawns/encounters (`SelectionSet`) |
| Duplication | `duplicate.ts` — `Ctrl+D` duplicates selected objects |
| Snapping/alignment | `snap.ts`, `layout.ts` — grid snap + align/distribute |
| Hotkeys | 15 bindings including copy/paste/nudge/search/presets |
| Command palette | `SearchOverlay.tsx` — `Ctrl+K` jump to any zone/entity/district/dialogue/tree |
| Object tree | `ObjectListPanel.tsx` — hierarchical (district → zone → entities) |
| Validation panel | `ValidationPanel.tsx` — grouped by domain, click-to-focus navigation |
| Scene preview | `ScenePreview.tsx` — HTML composed preview per zone |
| Export modal | `ExportModal.tsx` — pre-check validation, go-to-first-issue, AI RPG + Unreal targets |
| Import/round-trip | `ImportModal.tsx`, `DiffPanel.tsx`, `ImportSummaryPanel.tsx` |
| Mode profiles | `mode-profiles.ts` — authoring modes (dungeon/overworld/etc) |
| Theme | Dark/light toggle (FT-030) |
| Speed panel | `SpeedPanel.tsx` — batch operations |
| Presets | `PresetBrowser.tsx` — save/apply region and encounter presets |
| Dependency tracking | `DependencyPanel.tsx` — broken/orphaned ref detection |
| Review workflow | `ReviewPanel.tsx` |
| Kits | `EditKitModal.tsx`, `ImportKitModal.tsx`, `SaveKitModal.tsx` |

### The Two Blockers

| # | Module | Issue | Fix Complexity |
|---|--------|-------|----------------|
| 1 | `export-ai-rpg/src/export.ts` | `import { createRequire } from 'node:module'` — reads schema version at load time | Trivial — replace with `SCHEMA_VERSION` constant already exported from `@world-forge/schema` |
| 2 | `export-unreal/src/signing.ts` | `import { createHash } from 'node:crypto'` — loaded eagerly via barrel | Low — lazy-load `node:crypto` or use Web Crypto API |

Both are < 20 lines to fix. The editor's 35+ panels, store architecture, and interaction model are all sound — the product is a single `node:*` externalization fix away from running.

---

## Verdict Categories

| Category | Definition | Applies? |
|----------|-----------|----------|
| **PASS** | Authoring loop is coherent | No — can't verify |
| **PASS_WITH_FRICTION** | Core works, UX slows authors | No — can't verify |
| **BLOCKED** | Editor cannot reliably author the proof world | **YES** |
| **MISLEADING** | Editor displays something different from exported truth | No — can't verify |

---

## Recommendation

Fix the two Node-only imports (estimated: 10 minutes of code changes), rebuild, then re-run this audit. The static evidence strongly suggests the editor will land at **PASS** or **PASS_WITH_FRICTION** once it renders — the feature surface is extensive and well-structured. But until it boots, the verdict is BLOCKED.

---

## Reproduction

```bash
cd packages/editor
npx vite --port 5199
# Open http://localhost:5199/ — blank screen, console errors
```
