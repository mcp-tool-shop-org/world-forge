<p align="center">
  <img src="assets/logo.png" alt="World Forge" width="400">
</p>

<h1 align="center">World Forge</h1>

<p align="center">2D world authoring studio for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>.<br>Paint zones, place entities, define districts — export a complete ContentPack ready to play.</p>

## Architecture

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Quick Start

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` to launch the editor.

### Editor Workflow

1. **Paint zones** — select the Zone tool, drag on the canvas to create rectangular zones
2. **Connect zones** — select the Connection tool, click zone A then zone B
3. **Create districts** — group zones into districts with faction and economy metadata
4. **Place entities** — drop NPCs, enemies, merchants, spawn points onto zones
5. **Export** — click Export to validate and download an ai-rpg-engine ContentPack

### CLI Export

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Packages

### @world-forge/schema

Core TypeScript types for world authoring: `WorldMap`, `Zone`, `ZoneConnection`, `District`, `EntityPlacement`, `ItemPlacement`, `SpawnPoint`, `Landmark`, visual layers (`Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`). Includes `validateProject()` with 12 structural checks.

### @world-forge/export-ai-rpg

Converts a `WorldProject` into ai-rpg-engine's `ContentPack` format — zones, districts, entities, items, manifest, and pack metadata. Validates both input (schema validation) and output (engine content-schema validation).

### @world-forge/renderer-2d

PixiJS-based 2D renderer: viewport with pan/zoom, zone overlays with district coloring, connection arrows, entity icons by role, tile layers, and a minimap.

### @world-forge/editor

React 19 + Vite web app. Zustand state management with undo/redo. Tools: select, zone-paint, connection, entity-place, landmark, spawn. Panels: zone properties, district editor, entity reference, export modal.

## Engine Compatibility

Exports target [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) content types. The exported ContentPack can be loaded directly by [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Security

- **Data touched:** project files on local disk (user-created JSON), no server-side storage
- **Data NOT touched:** no telemetry, no analytics, no network requests beyond local dev server
- **Permissions:** no API keys, no secrets, no credentials
- **No secrets, tokens, or credentials in source**

## License

MIT
