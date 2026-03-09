<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/world-forge/readme.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

React 19 web app for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — a 2D world authoring studio for AI RPG Engine.

## Features

- **Canvas** — paint zones, draw connections, place entities and landmarks on a 2D grid with pan/zoom viewport
- **Multi-select** — click, shift-click, and box-select zones, entities, landmarks, and spawns; drag-move selected objects with atomic undo
- **Batch editing** — batch district assignment, batch tag add, and batch delete when multiple zones selected
- **Keyboard shortcuts** — Escape, Ctrl+A, Delete, Arrow nudge for fast spatial editing
- **Workspace tabs** — Map, Player, Builds, Trees, Dialogue, Assets, Issues, Guide
- **Asset library** — manage portraits, sprites, backgrounds, icons, and tilesets with kind-specific bindings
- **Undo/redo** — 10-deep history stack via Zustand
- **Import/Export** — round-trip fidelity reporting, semantic diff tracking
- **Validation** — 42 structural checks with click-to-focus issue navigation
- **Templates** — genre starters and sample worlds for quick onboarding

## Quick Start

```bash
npm install
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` to launch the editor.

## License

MIT
