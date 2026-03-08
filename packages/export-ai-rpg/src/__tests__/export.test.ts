import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertZones } from '../convert-zones.js';
import { convertDistricts } from '../convert-districts.js';
import { convertEntities } from '../convert-entities.js';
import { convertItems } from '../convert-items.js';
import { convertDialogues } from '../convert-dialogues.js';
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

describe('exportToEngine', () => {
  it('exports minimal project successfully', () => {
    const result = exportToEngine(minimalProject);
    expect('ok' in result).toBe(false); // not an error
    if (!('ok' in result)) {
      expect(result.contentPack.zones).toHaveLength(2);
      expect(result.contentPack.entities).toHaveLength(1);
      expect(result.contentPack.districts).toHaveLength(1);
      expect(result.contentPack.dialogues).toHaveLength(1);
      expect(result.manifest.id).toBe('minimal-test');
    }
  });

  it('exports chapel project successfully', () => {
    const result = exportToEngine(chapelProject);
    expect('ok' in result).toBe(false);
    if (!('ok' in result)) {
      expect(result.contentPack.zones).toHaveLength(5);
      expect(result.contentPack.entities).toHaveLength(4);
      expect(result.contentPack.districts).toHaveLength(2);
      expect(result.contentPack.items).toHaveLength(3);
      expect(result.contentPack.dialogues).toHaveLength(1);
      expect(result.contentPack.dialogues[0].id).toBe('pilgrim-talk');
    }
  });

  it('rejects invalid project', () => {
    const result = exportToEngine(invalidOrphanProject);
    expect('ok' in result).toBe(true);
    if ('ok' in result) {
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('warns on missing landmarks', () => {
    const noLandmarks = { ...minimalProject, landmarks: [] };
    const result = exportToEngine(noLandmarks);
    if (!('ok' in result)) {
      expect(result.warnings.some((w) => w.includes('landmark'))).toBe(true);
    }
  });
});
