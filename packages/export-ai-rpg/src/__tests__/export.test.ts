import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertZones } from '../convert-zones.js';
import { convertDistricts } from '../convert-districts.js';
import { convertEntities } from '../convert-entities.js';
import { convertItems } from '../convert-items.js';
import { convertDialogues } from '../convert-dialogues.js';
import { convertPlayerTemplate } from '../convert-player-template.js';
import { convertBuildCatalog } from '../convert-build-catalog.js';
import { convertProgressionTrees } from '../convert-progression-trees.js';
import { convertManifest, convertPackMeta } from '../convert-pack.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';

describe('convertZones', () => {
  it('converts minimal project zones', () => {
    const zones = convertZones(minimalProject);
    expect(zones).toHaveLength(2);
    expect(zones[0].id).toBe('zone-entrance');
    expect(zones[0].name).toBe('Entrance Hall');
    expect(zones[0].neighbors).toContain('zone-cellar');
    expect(zones[0].exits).toHaveLength(1);
    expect(zones[0].exits![0].targetZoneId).toBe('zone-cellar');
  });

  it('converts chapel zones with hazards', () => {
    const zones = convertZones(chapelProject);
    const crypt = zones.find((z) => z.id === 'crypt-chamber');
    expect(crypt).toBeDefined();
    expect(crypt!.hazards).toContain('crumbling-floor');
    expect(crypt!.light).toBe(1);
  });
});

describe('convertDistricts', () => {
  it('converts minimal project districts', () => {
    const districts = convertDistricts(minimalProject);
    expect(districts).toHaveLength(1);
    expect(districts[0].id).toBe('district-chapel');
    expect(districts[0].zoneIds).toContain('zone-entrance');
  });

  it('maps safety to surveillance', () => {
    const districts = convertDistricts(minimalProject);
    expect(districts[0].baseMetrics?.surveillance).toBe(60); // safety was 60
  });
});

describe('convertEntities', () => {
  it('converts chapel entities with roles', () => {
    const entities = convertEntities(chapelProject);
    expect(entities).toHaveLength(4);

    const boss = entities.find((e) => e.id === 'ash-ghoul');
    expect(boss).toBeDefined();
    expect(boss!.type).toBe('enemy');
    expect(boss!.tags).toContain('boss');
    expect(boss!.aiProfile).toBe('aggressive'); // authored ai.profileId overrides role default
    expect(boss!.baseStats).toEqual({ vigor: 4, instinct: 3, will: 1 });
    expect(boss!.baseResources).toEqual({ hp: 12, stamina: 4 });

    const companion = entities.find((e) => e.id === 'brother-aldric');
    expect(companion).toBeDefined();
    expect(companion!.tags).toContain('recruitable');
    expect(companion!.tags).toContain('healer');
    expect(companion!.aiProfile).toBe('follower');
    expect(companion!.baseStats).toEqual({ vigor: 3, instinct: 3, will: 7 });
    expect(companion!.baseResources).toEqual({ hp: 12 });
  });

  it('adds faction tags', () => {
    const entities = convertEntities(chapelProject);
    const maren = entities.find((e) => e.id === 'sister-maren');
    expect(maren!.tags).toContain('faction:chapel-order');
  });
});

describe('convertItems', () => {
  it('converts item placements', () => {
    const items = convertItems(chapelProject);
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('rusted-mace');
  });

  it('marks hidden items with contraband flag', () => {
    const items = convertItems(chapelProject);
    const talisman = items.find((i) => i.id === 'bone-talisman');
    expect(talisman!.provenance?.flags).toContain('contraband');
  });
});

describe('convertManifest', () => {
  it('creates manifest with project metadata', () => {
    const manifest = convertManifest(minimalProject);
    expect(manifest.id).toBe('minimal-test');
    expect(manifest.title).toBe('Minimal Test World');
    expect(manifest.modules).toContain('combat-core');
    expect(manifest.contentPacks).toContain('minimal-test');
  });
});

describe('convertPackMeta', () => {
  it('maps genre and tones', () => {
    const meta = convertPackMeta(chapelProject);
    expect(meta.genres).toContain('fantasy');
    expect(meta.tones).toContain('dark');
    expect(meta.tones).toContain('atmospheric');
    expect(meta.difficulty).toBe('beginner');
  });
});

describe('convertDialogues', () => {
  it('converts chapel pilgrim dialogue', () => {
    const dialogues = convertDialogues(chapelProject);
    expect(dialogues).toHaveLength(1);
    expect(dialogues[0].id).toBe('pilgrim-talk');
    expect(dialogues[0].speakers).toEqual(['suspicious-pilgrim']);
    expect(dialogues[0].entryNodeId).toBe('greeting');
  });

  it('preserves node structure and choices', () => {
    const dialogues = convertDialogues(chapelProject);
    const dlg = dialogues[0];
    const greeting = dlg.nodes['greeting'];
    expect(greeting.speaker).toBe('Suspicious Pilgrim');
    expect(greeting.choices).toHaveLength(3);
    expect(greeting.choices![0].nextNodeId).toBe('warn-crypt');
  });

  it('preserves effects on choices', () => {
    const dialogues = convertDialogues(chapelProject);
    const dlg = dialogues[0];
    const warnCrypt = dlg.nodes['warn-crypt'];
    expect(warnCrypt.choices![0].effects).toHaveLength(1);
    expect(warnCrypt.choices![0].effects![0].type).toBe('set-global');
    expect(warnCrypt.choices![0].effects![0].params.key).toBe('pilgrim-warned');
  });

  it('converts minimal keeper dialogue', () => {
    const dialogues = convertDialogues(minimalProject);
    expect(dialogues).toHaveLength(1);
    expect(dialogues[0].id).toBe('dlg-keeper');
    expect(Object.keys(dialogues[0].nodes)).toHaveLength(3);
  });

  it('returns empty array for no dialogues', () => {
    const dialogues = convertDialogues({ ...minimalProject, dialogues: [] });
    expect(dialogues).toHaveLength(0);
  });
});

describe('convertPlayerTemplate', () => {
  it('converts chapel player template', () => {
    const pt = convertPlayerTemplate(chapelProject);
    expect(pt).toBeDefined();
    expect(pt!.name).toBe('Wanderer');
    expect(pt!.spawnPointId).toBe('chapel-spawn');
    expect(pt!.baseStats).toEqual({ vigor: 3, instinct: 4, will: 2 });
    expect(pt!.startingEquipment).toEqual({ weapon: 'rusted-mace' });
    expect(pt!.tags).toContain('player');
  });

  it('returns undefined when no player template', () => {
    const pt = convertPlayerTemplate({ ...minimalProject, playerTemplate: undefined });
    expect(pt).toBeUndefined();
  });
});

describe('convertBuildCatalog', () => {
  it('converts chapel build catalog with packId', () => {
    const bc = convertBuildCatalog(chapelProject);
    expect(bc).toBeDefined();
    expect(bc!.packId).toBe('chapel-threshold');
    expect(bc!.statBudget).toBe(12);
    expect(bc!.archetypes).toHaveLength(2);
    expect(bc!.backgrounds).toHaveLength(2);
    expect(bc!.traits).toHaveLength(3);
    expect(bc!.disciplines).toHaveLength(1);
    expect(bc!.crossTitles).toHaveLength(1);
    expect(bc!.entanglements).toHaveLength(1);
  });

  it('maps archetype fields correctly', () => {
    const bc = convertBuildCatalog(chapelProject)!;
    const wanderer = bc.archetypes.find((a) => a.id === 'wanderer');
    expect(wanderer!.progressionTreeId).toBe('tree-wanderer');
    expect(wanderer!.grantedVerbs).toContain('scavenge');
    expect(wanderer!.startingTags).toContain('traveler');
  });

  it('maps trait effects correctly', () => {
    const bc = convertBuildCatalog(chapelProject)!;
    const ironGut = bc.traits.find((t) => t.id === 'iron-gut');
    expect(ironGut!.category).toBe('perk');
    expect(ironGut!.effects[0].type).toBe('grant-tag');
  });

  it('returns undefined when no build catalog', () => {
    const bc = convertBuildCatalog({ ...minimalProject, buildCatalog: undefined });
    expect(bc).toBeUndefined();
  });
});

describe('convertProgressionTrees', () => {
  it('converts chapel progression trees', () => {
    const trees = convertProgressionTrees(chapelProject);
    expect(trees).toHaveLength(2);
    expect(trees[0].id).toBe('tree-wanderer');
    expect(trees[0].currency).toBe('xp');
    expect(trees[0].nodes).toHaveLength(3);
  });

  it('preserves node requirements and effects', () => {
    const trees = convertProgressionTrees(chapelProject);
    const wanderer = trees.find((t) => t.id === 'tree-wanderer')!;
    const survivor = wanderer.nodes.find((n) => n.id === 'survivors-luck');
    expect(survivor!.requires).toEqual(['keen-senses']);
    expect(survivor!.effects[0].type).toBe('grant-tag');
    expect(survivor!.effects[0].params.tag).toBe('lucky');
  });

  it('returns empty array for no trees', () => {
    const trees = convertProgressionTrees({ ...minimalProject, progressionTrees: [] });
    expect(trees).toHaveLength(0);
  });
});

describe('exportToEngine', () => {
  it('exports minimal project successfully', () => {
    const result = exportToEngine(minimalProject);
    expect(result.success).toBe(true); // not an error
    if (result.success) {
      expect(result.contentPack.zones).toHaveLength(2);
      expect(result.contentPack.entities).toHaveLength(1);
      expect(result.contentPack.districts).toHaveLength(1);
      expect(result.contentPack.dialogues).toHaveLength(1);
      expect(result.manifest.id).toBe('minimal-test');
    }
  });

  it('exports chapel project successfully with all v1.2 domains', () => {
    const result = exportToEngine(chapelProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentPack.zones).toHaveLength(5);
      expect(result.contentPack.entities).toHaveLength(4);
      expect(result.contentPack.districts).toHaveLength(2);
      expect(result.contentPack.items).toHaveLength(3);
      expect(result.contentPack.dialogues).toHaveLength(1);
      expect(result.contentPack.dialogues[0].id).toBe('pilgrim-talk');
      // v1.2 domains
      expect(result.contentPack.playerTemplate).toBeDefined();
      expect(result.contentPack.playerTemplate!.name).toBe('Wanderer');
      expect(result.contentPack.buildCatalog).toBeDefined();
      expect(result.contentPack.buildCatalog!.archetypes).toHaveLength(2);
      expect(result.contentPack.progressionTrees).toHaveLength(2);
      // No missing-feature warnings for chapel
      expect(result.warnings.some((w) => w.includes('player template'))).toBe(false);
      expect(result.warnings.some((w) => w.includes('build catalog'))).toBe(false);
      expect(result.warnings.some((w) => w.includes('progression trees'))).toBe(false);
    }
  });

  it('rejects invalid project', () => {
    const result = exportToEngine(invalidOrphanProject);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('warns on missing v1.2 features', () => {
    const bare = { ...minimalProject, playerTemplate: undefined, buildCatalog: undefined, progressionTrees: [] as any[] };
    const result = exportToEngine(bare);
    if (result.success) {
      expect(result.warnings.some((w) => w.includes('player template'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('build catalog'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('progression trees'))).toBe(true);
    }
  });

  it('warns on missing landmarks', () => {
    const noLandmarks = { ...minimalProject, landmarks: [] };
    const result = exportToEngine(noLandmarks);
    if (result.success) {
      expect(result.warnings.some((w) => w.includes('landmark'))).toBe(true);
    }
  });

  it('includes assets and assetBindings when project has assets', () => {
    const withAssets = {
      ...minimalProject,
      assets: [
        { id: 'bg-1', kind: 'background' as const, label: 'BG', path: 'bg.png', tags: [] },
        { id: 'portrait-1', kind: 'portrait' as const, label: 'NPC', path: 'npc.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'bg-1' } : z,
      ),
      entityPlacements: [
        { entityId: 'npc-1', zoneId: 'zone-entrance', role: 'npc' as const, portraitId: 'portrait-1' },
      ],
    };
    const result = exportToEngine(withAssets);
    if (result.success) {
      expect(result.assets).toHaveLength(2);
      expect(result.assetBindings?.zones?.['zone-entrance']?.backgroundId).toBe('bg-1');
      expect(result.assetBindings?.entities?.['npc-1']?.portraitId).toBe('portrait-1');
    }
  });

  it('omits assets and assetBindings when project has no assets', () => {
    const result = exportToEngine(minimalProject);
    if (result.success) {
      expect(result.assets).toBeUndefined();
      expect(result.assetBindings).toBeUndefined();
    }
  });
});
