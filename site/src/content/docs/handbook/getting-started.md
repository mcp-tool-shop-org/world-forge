---
title: Getting Started
description: Install, build, and launch the World Forge editor
sidebar:
  order: 1
---

## Prerequisites

- Node.js 20 or later
- npm 10 or later

## Install

```bash
git clone https://github.com/mcp-tool-shop-org/world-forge
cd world-forge
npm install
```

## Build

World Forge uses TypeScript project references across its monorepo. A single command builds all packages in dependency order:

```bash
npm run build
```

This runs `tsc --build`, which resolves the dependency graph: schema first, then renderer-2d and export-ai-rpg (both depend on schema), then editor (depends on all three).

## Launch the Editor

```bash
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` in your browser. The editor loads the Template Manager where you can choose a genre template, a sample project, a **starter kit**, or start blank. Each new project starts with an **authoring mode** (dungeon, district, world, ocean, space, interior, or wilderness) that sets grid dimensions, connection vocabulary, and guide text to match your world's scale. The **Starter Kits** tab provides 7 built-in kits (one per mode) — each with 4 zones, entities, dialogues, encounters, and a complete player template ready to explore. You can also create your own custom kits from any project via "Save as Kit", then edit their metadata, preset references, and guide hints. Custom kits can be exported as portable `.wfkit.json` files and imported on other machines — share house styles, back up kits, or distribute starter templates. Full projects can also be exported as `.wfproject.json` bundles and imported elsewhere — share authored worlds, back up work-in-progress, or move projects between machines.

## Run Tests

```bash
npm test
```

This runs Vitest across all packages. The test suite covers schema validation and the export pipeline.

## Verify Everything

```bash
npm run verify
```

This runs `npm run build && npm run test` — the same command CI uses.

## Using the Published Packages

If you want to use World Forge types or the export pipeline in your own project:

```bash
npm install @world-forge/schema @world-forge/export-ai-rpg
```

```typescript
import type { WorldProject } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';
import { exportToEngine } from '@world-forge/export-ai-rpg';
```
