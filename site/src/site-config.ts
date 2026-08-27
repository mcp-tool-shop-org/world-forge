import type { SiteConfig } from '@mcptoolshop/site-theme';
// Version is sourced from the root workspace package.json at build time so the
// landing page hero always reflects the current release (see INF-B-001). Do not
// hardcode the version string below — bumping root package.json is sufficient.
import rootPkg from '../../package.json' with { type: 'json' };

const VERSION = rootPkg.version;

export const config: SiteConfig = {
  title: 'World Forge',
  description: '2D / 2.5D world authoring studio with peer export lanes for AI RPG Engine, Unreal Engine 5, and Godot 4.',
  logoBadge: 'WF',
  brandName: 'World Forge',
  repoUrl: 'https://github.com/mcp-tool-shop-org/world-forge',
  npmUrl: 'https://www.npmjs.com/package/@world-forge/schema',
  footerText: 'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">MCP Tool Shop</a>',

  hero: {
    badge: `v${VERSION} — 2D / 2.5D World Authoring Studio`,
    headline: 'World Forge:',
    headlineAccent: 'Author. Validate. Export.',
    description: 'Paint zones and tiles on a 2D canvas, define districts and factions, place entities, author towns (markets, buildings, hubs, strongholds), vertical strata, typed hazards, and party-gated zones — export a complete, engine-verified content pack for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine" style="text-decoration:underline">ai-rpg-engine</a>, <a href="https://www.unrealengine.com/" style="text-decoration:underline">Unreal Engine 5</a>, or <a href="https://godotengine.org/" style="text-decoration:underline">Godot 4</a>.',
    primaryCta: { href: '#quickstart', label: 'Get Started' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      { label: 'Install', code: 'npm install\nnpm run build' },
      { label: 'Editor', code: 'npm run dev --workspace=packages/editor\n# → http://localhost:5173' },
      { label: 'Export (Godot 4)', code: 'npx world-forge-export-godot project.json \\\n  --out ./GodotPack' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'features',
      title: 'Features',
      subtitle: 'Paint a world. Validate it. Export it to three engines.',
      features: [
        {
          title: 'Zone Painting',
          desc: 'Drag to create zones with snap-to-grid layout, resize handles, multi-select, and object snapping. The canvas is the product.',
        },
        {
          title: 'Dependencies & Validation',
          desc: 'Live validation with 89 structural checks, a dependency scanner, and one-click repair. Invalid worlds cannot export as lossless.',
        },
        {
          title: 'Three Export Lanes',
          desc: 'AI RPG Engine ContentPack, Unreal Engine 5 UnrealContentPack (2.5D-aware), and Godot 4 playable .tscn — plus portable ProjectBundle.',
        },
        {
          title: '2.5D Authoring',
          desc: 'Elevation ranges, parallax layers, and skyline refs on the canvas. UE5 export emits Z-up coordinates and collision channels.',
        },
        {
          title: 'Godot 4 Playable Scene',
          desc: 'A navigable .tscn: per-zone collision + navmesh, TileMapLayer, town structures, strata, hazards — verified against real Godot 4 headless.',
        },
        {
          title: 'Tiles & Interiors',
          desc: 'Image-backed tilesets with a colored-rect fallback, layers, wall collision, and a prop palette for interiors.',
        },
      ],
    },
    {
      kind: 'code-cards',
      id: 'quickstart',
      title: 'Quick Start',
      cards: [
        {
          title: 'Install',
          code: '# Clone and install\ngit clone https://github.com/mcp-tool-shop-org/world-forge\ncd world-forge\nnpm install\nnpm run build',
        },
        {
          title: 'Launch Editor',
          code: '# Start the web editor\nnpm run dev --workspace=packages/editor\n\n# Open http://localhost:5173\n# Paint zones, connect, place entities, export',
        },
        {
          title: 'CLI Export',
          code: '# AI RPG Engine\nnpx world-forge-export project.json --out ./pack\n\n# Unreal Engine 5 (2.5D-aware)\nnpx world-forge-export-unreal project.json --out ./UnrealPack\n\n# Godot 4 (loadable project root)\nnpx world-forge-export-godot project.json --out ./GodotPack\n\n# Validate without writing files\nnpx world-forge-export project.json --dry-run',
        },
      ],
    },
    {
      kind: 'data-table',
      id: 'surface',
      title: 'Authoring Surface',
      subtitle: 'What World Forge authors today and what is planned.',
      columns: ['Feature', 'Status'],
      rows: [
        ['Zones (spatial layout, neighbors, exits)', 'Shipped'],
        ['Connections (bidirectional, conditional)', 'Shipped'],
        ['Districts (faction control, economy)', 'Shipped'],
        ['Landmarks (points of interest)', 'Shipped'],
        ['Entities (stats, resources, AI profiles)', 'Shipped'],
        ['Items (slot, rarity, modifiers, verbs)', 'Shipped'],
        ['Dialogues (branching, conditions, effects)', 'Shipped'],
        ['Spawn points & encounter anchors', 'Shipped'],
        ['Faction presences & pressure hotspots', 'Shipped'],
        ['Player template (stats, inventory, equipment)', 'Shipped'],
        ['Build catalog (archetypes, backgrounds, traits)', 'Shipped'],
        ['Progression trees (skill nodes, requirements)', 'Shipped'],
        ['Starter kits & project bundles (.wfkit.json, .wfproject.json)', 'Shipped'],
        ['Dependency scanner (broken refs, orphan detection, repair)', 'Shipped'],
        ['Review dashboard (health, content overview, summary export)', 'Shipped'],
        ['Speed Panel (command palette, macros, custom groups)', 'Shipped'],
        ['2.5D fields: elevation, elevationRange, parallaxLayers, skylineRef', 'Shipped (v4.2.0)'],
        ['Zone 2.5D editor UI + canvas elevation badge + parallax preview', 'Shipped (v4.3.0)'],
        ['Unreal Engine 5 export (UnrealContentPack, 2.5D aware)', 'Shipped (v4.2.0)'],
        ['UE5 sky/lighting metadata, collision channels, parallax spawn manifest', 'Shipped (v4.3.0)'],
        ['LootTable, SpawnCondition grammar, TransitionEntity', 'Shipped (v4.3.0)'],
        ['Zone physics overrides (gravity, zero-g, aquatic)', 'Shipped (v4.3.0)'],
        ['AI RPG Engine export profiles (debug/release) + --dry-run', 'Shipped (v4.3.0)'],
        ['Godot 4 export (playable .tscn: collision, navmesh, camera, y-sort)', 'Shipped (v4.5.0)'],
        ['Tile pipeline (image + fallback tilesets, brush, Godot TileMapLayer)', 'Shipped (v4.5.0)'],
        ['Interiors: prop placement + tile wall collision', 'Shipped (v4.5.0)'],
        ['Town economy (markets, crafting) + structures (buildings, hubs, strongholds)', 'Shipped (v4.5.0)'],
        ['World modeling: vertical strata + typed hazards + entry party-gates', 'Shipped (v4.5.0)'],
        ['Forge→Engine alignment audit (measured export table + leaf-path differ)', 'Shipped (v4.6.0)'],
        ['Content-pack manifest truth (real semver range, content hash, gated module ids)', 'Shipped (v4.6.0)'],
        ['Space vocabulary crossing (compiled spawn conditions, hazards, entry gates, scene descriptors)', 'Shipped (v4.6.0)'],
        ['UE5 reference loader plugin', 'Ships with Star Freight'],
        ['Quest system + Canon adapter v1 + faction relationships', 'Planned'],
      ],
    },
  ],
};
