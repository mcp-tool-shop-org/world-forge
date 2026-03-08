import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertZones } from '../convert-zones.js';
import { convertDistricts } from '../convert-districts.js';
import { convertEntities } from '../convert-entities.js';
import { convertItems } from '../convert-items.js';
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
    expect(boss!.aiProfile).toBe('territorial');

    const companion = entities.find((e) => e.id === 'brother-aldric');
    expect(companion).toBeDefined();
    expect(companion!.tags).toContain('recruitable');
    expect(companion!.aiProfile).toBe('follower');
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

describe('exportToEngine', () => {
  it('exports minimal project successfully', () => {
    const result = exportToEngine(minimalProject);
    expect('ok' in result).toBe(false); // not an error
    if (!('ok' in result)) {
      expect(result.contentPack.zones).toHaveLength(2);
      expect(result.contentPack.entities).toHaveLength(1);
      expect(result.contentPack.districts).toHaveLength(1);
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
