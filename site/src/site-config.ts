import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: 'World Forge',
  description: '2D world authoring studio for AI RPG Engine',
  logoBadge: 'WF',
  brandName: 'World Forge',
  repoUrl: 'https://github.com/mcp-tool-shop-org/world-forge',
  npmUrl: 'https://www.npmjs.com/package/@world-forge/schema',
  footerText: 'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">MCP Tool Shop</a>',

  hero: {
    badge: '2D World Authoring Studio',
    headline: 'World Forge:',
    headlineAccent: 'Author. Validate. Export.',
    description: 'Paint zones on a 2D canvas, define districts and factions, place entities with stats and AI profiles, author branching dialogue trees — export a complete ContentPack for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine" style="text-decoration:underline">ai-rpg-engine</a>.',
    primaryCta: { href: '#quickstart', label: 'Get Started' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      { label: 'Install', code: 'npm install\nnpm run build' },
      { label: 'Editor', code: 'npm run dev --workspace=packages/editor\n# → http://localhost:5173' },
      { label: 'Export', code: 'npx world-forge-export project.json \\\n  --out ./my-pack' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'features',
      title: 'Features',
      subtitle: 'Everything you need to author worlds for narrative RPGs.',
      features: [
        {
          title: 'Zone Painting',
          desc: 'Drag to create zones with snap-to-grid layout, resize handles, multi-select with box-select, alignment and distribution tools, and object snapping with visual guides.',
        },
        {
          title: 'Districts & Factions',
          desc: 'Group zones into districts with faction control, economy profiles, pressure hotspots, and base metrics. Track faction influence, alert levels, and district-level presences.',
        },
        {
          title: 'Entity Placement',
          desc: 'Drop NPCs, enemies, merchants, companions, and bosses onto zones. Author stats, resources, AI profiles, and custom metadata.',
        },
        {
          title: 'Dialogue Trees',
          desc: 'Author branching NPC conversations with conditions, effects, and multiple choice paths. Validated for broken links and unreachable nodes.',
        },
        {
          title: 'Character Creation',
          desc: 'Define player templates, build catalogs with archetypes, backgrounds, traits, disciplines, entanglements, cross-titles, and progression trees with skill nodes.',
        },
        {
          title: 'Starter Kits & Templates',
          desc: '7 mode-specific starter kits, genre wizard, sample worlds, and user templates. Kit import/export (.wfkit.json) with collision handling and provenance tracking.',
        },
        {
          title: 'Dependencies & Validation',
          desc: 'Live validation with 54 structural checks. Dependency scanner surfaces broken, mismatched, and orphaned references with one-click repair and click-to-focus navigation.',
        },
        {
          title: 'Review & Export',
          desc: 'Health dashboard, content overview, and summary export (Markdown/JSON). Export to ContentPack, ProjectBundle (.wfproject.json), or review summary. Multi-format import with fidelity reporting.',
        },
        {
          title: 'Speed Panel & Shortcuts',
          desc: 'Double-right-click command palette with context-aware actions, pinnable favorites, macros with step editor, 13 keyboard shortcuts, and Ctrl+K search across all objects.',
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
          code: '# Export a project file\nnpx world-forge-export project.json --out ./pack\n\n# Validate without exporting\nnpx world-forge-export project.json --validate-only',
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
      ],
    },
  ],
};
