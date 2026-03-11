<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

React 19 web app for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — a 2D world authoring studio for AI RPG Engine.

## Features

- **Canvas** — paint zones, draw connections, place entities, landmarks, and encounters on a 2D grid with pan/zoom viewport
- **Multi-select** — click, shift-click, and box-select zones, entities, landmarks, spawns, and encounters; drag-move selected objects with atomic undo
- **Encounter authoring** — place encounter anchors on zones with type-based canvas markers (boss, ambush, patrol), editable properties (enemy IDs, probability, cooldown, tags)
- **District editing** — expanded district panel with metrics sliders, tags, controlling faction, economy profile, faction presence management, and pressure hotspot editing
- **Batch editing** — batch district assignment, batch tag add, and batch delete when multiple zones selected
- **Preset system** — region and encounter presets with merge/overwrite application, 4 built-in region presets, 3 built-in encounter presets, custom preset CRUD with localStorage persistence
- **Keyboard shortcuts** — centralized hotkey registry with 13 bindings: Escape, Ctrl+A, Ctrl+D, Ctrl+K, Delete, Arrow nudge, Enter (open details), P (apply preset), Shift+P (save preset)
- **Double-click** — double-click any canvas object to select it, switch to Map tab, and center viewport
- **Speed Panel** — double-right-click canvas to open a floating command palette with context-aware actions, pinnable favorites (reorder in edit mode), recent actions, custom groups, lightweight macros with step editor, search filtering, and keyboard navigation
- **Workspace tabs** — Map, Player, Builds, Trees, Dialogue, Objects, Presets, Assets, Issues, Guide
- **Asset library** — manage portraits, sprites, backgrounds, icons, and tilesets with kind-specific bindings
- **Undo/redo** — 10-deep history stack via Zustand
- **Import/Export** — round-trip fidelity reporting, semantic diff tracking
- **Validation** — 54 structural checks with click-to-focus issue navigation
- **Templates** — genre starters and sample worlds for quick onboarding

## Quick Start

```bash
npm install
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` to launch the editor.

## Styling Architecture

The editor uses inline `style={}` props with a two-layer design-token system:

1. **CSS custom properties** (`src/ui/theme.css`) — single source of truth for colors, spacing, typography, z-indices
2. **TypeScript style objects** (`src/ui/styles.ts`) — reusable `CSSProperties` objects referencing the CSS variables
3. **ModalFrame component** (`src/ui/ModalFrame.tsx`) — shared modal shell used by 6 of 7 modals

See [`src/ui/DESIGN-SYSTEM.md`](src/ui/DESIGN-SYSTEM.md) for the full token reference and contributor conventions.

## License

MIT
