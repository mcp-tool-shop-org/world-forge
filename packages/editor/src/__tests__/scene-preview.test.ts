import { describe, it, expect } from 'vitest';
import type { WorldProject } from '@world-forge/schema';
import { SAMPLE_WORLDS } from '../templates/registry.js';
import { assembleSceneData } from '../panels/scene-preview-utils.js';

const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!;

describe('assembleSceneData — chapel-entrance', () => {
  const scene = assembleSceneData('chapel-entrance', chapel.project);

  it('resolves background asset', () => {
    expect(scene.background).not.toBeNull();
    expect(scene.background!.missing).toBe(false);
    if (!scene.background!.missing) {
      expect(scene.background!.asset.id).toBe('chapel-entrance-bg');
      expect(scene.background!.asset.kind).toBe('background');
    }
  });

  it('has pilgrim entity with portrait', () => {
    expect(scene.entities.length).toBeGreaterThanOrEqual(1);
    const pilgrim = scene.entities.find((e) => e.placement.entityId === 'suspicious-pilgrim');
    expect(pilgrim).toBeDefined();
    expect(pilgrim!.portrait).not.toBeNull();
    expect(pilgrim!.portrait!.id).toBe('pilgrim-portrait');
    expect(pilgrim!.missingPortrait).toBe(false);
  });

  it('has spawn point', () => {
    expect(scene.spawns.length).toBeGreaterThanOrEqual(1);
    expect(scene.spawns[0].id).toBe('chapel-spawn');
  });

  it('has items (rusted-mace, chapel-lantern)', () => {
    expect(scene.items.length).toBeGreaterThanOrEqual(2);
    const itemIds = scene.items.map((i) => i.item.itemId);
    expect(itemIds).toContain('rusted-mace');
    expect(itemIds).toContain('chapel-lantern');
  });

  it('has connection to chapel-nave', () => {
    expect(scene.connections.length).toBeGreaterThanOrEqual(1);
    const naveConn = scene.connections.find((c) => c.zoneName === 'Chapel Nave');
    expect(naveConn).toBeDefined();
  });
});

describe('assembleSceneData — crypt-chamber', () => {
  const scene = assembleSceneData('crypt-chamber', chapel.project);

  it('resolves background asset', () => {
    expect(scene.background).not.toBeNull();
    expect(scene.background!.missing).toBe(false);
    if (!scene.background!.missing) {
      expect(scene.background!.asset.id).toBe('crypt-bg');
    }
  });

  it('has ash-ghoul boss entity without portrait', () => {
    const ghoul = scene.entities.find((e) => e.placement.entityId === 'ash-ghoul');
    expect(ghoul).toBeDefined();
    expect(ghoul!.portrait).toBeNull();
    expect(ghoul!.missingPortrait).toBe(false);
  });

  it('has crypt-fog ambient layer', () => {
    expect(scene.ambient.length).toBeGreaterThanOrEqual(1);
    const fog = scene.ambient.find((a) => a.id === 'crypt-fog');
    expect(fog).toBeDefined();
    expect(fog!.type).toBe('fog');
  });

  it('has bone-talisman item with icon', () => {
    const talisman = scene.items.find((i) => i.item.itemId === 'bone-talisman');
    expect(talisman).toBeDefined();
    expect(talisman!.icon).not.toBeNull();
    expect(talisman!.icon!.id).toBe('bone-talisman-icon');
    expect(talisman!.missingIcon).toBe(false);
  });
});

describe('assembleSceneData — chapel-nave', () => {
  const scene = assembleSceneData('chapel-nave', chapel.project);

  it('has no background (backgroundId undefined)', () => {
    expect(scene.background).toBeNull();
  });

  it('has brother-aldric with portrait', () => {
    const aldric = scene.entities.find((e) => e.placement.entityId === 'brother-aldric');
    expect(aldric).toBeDefined();
    expect(aldric!.portrait).not.toBeNull();
    expect(aldric!.portrait!.id).toBe('aldric-portrait');
  });

  it('has no ambient layers', () => {
    expect(scene.ambient).toHaveLength(0);
  });

  it('has connections to entrance, alcove, and vestry', () => {
    expect(scene.connections.length).toBeGreaterThanOrEqual(3);
    const names = scene.connections.map((c) => c.zoneName);
    expect(names).toContain('Chapel Entrance');
    expect(names).toContain('Chapel Alcove');
    expect(names).toContain('Vestry Door');
  });
});

describe('assembleSceneData — missing asset detection', () => {
  it('returns missing: true when backgroundId references nonexistent asset', () => {
    const minimal: WorldProject = {
      ...chapel.project,
      zones: [{ ...chapel.project.zones[0], id: 'test-zone', backgroundId: 'bogus' }],
      assets: [],
    };
    const scene = assembleSceneData('test-zone', minimal);
    expect(scene.background).not.toBeNull();
    expect(scene.background!.missing).toBe(true);
    if (scene.background!.missing) {
      expect(scene.background!.id).toBe('bogus');
    }
  });
});

describe('assembleSceneData — empty zone', () => {
  it('returns all null/empty for zone with no bindings', () => {
    const minimal: WorldProject = {
      ...chapel.project,
      zones: [{ ...chapel.project.zones[0], id: 'empty-zone', backgroundId: undefined, tilesetId: undefined }],
      entityPlacements: [],
      itemPlacements: [],
      landmarks: [],
      spawnPoints: [],
      ambientLayers: [],
      connections: [],
    };
    const scene = assembleSceneData('empty-zone', minimal);
    expect(scene.background).toBeNull();
    expect(scene.tileset).toBeNull();
    expect(scene.entities).toHaveLength(0);
    expect(scene.items).toHaveLength(0);
    expect(scene.landmarks).toHaveLength(0);
    expect(scene.spawns).toHaveLength(0);
    expect(scene.ambient).toHaveLength(0);
    expect(scene.connections).toHaveLength(0);
  });
});

describe('assembleSceneData — entity missing portrait', () => {
  it('sets missingPortrait when portraitId references nonexistent asset', () => {
    const minimal: WorldProject = {
      ...chapel.project,
      zones: [{ ...chapel.project.zones[0], id: 'test-zone' }],
      entityPlacements: [{
        ...chapel.project.entityPlacements[0],
        zoneId: 'test-zone',
        portraitId: 'missing-portrait',
        spriteId: undefined,
      }],
      assets: [],
    };
    const scene = assembleSceneData('test-zone', minimal);
    expect(scene.entities).toHaveLength(1);
    expect(scene.entities[0].missingPortrait).toBe(true);
    expect(scene.entities[0].portrait).toBeNull();
  });
});

describe('assembleSceneData — connection with condition', () => {
  it('chapel-alcove → crypt-chamber includes condition', () => {
    const scene = assembleSceneData('chapel-alcove', chapel.project);
    const cryptConn = scene.connections.find((c) => c.zoneName === 'Crypt Chamber');
    expect(cryptConn).toBeDefined();
    expect(cryptConn!.condition).toBe('has-tag:chapel-key');
  });
});

describe('assembleSceneData — nonexistent zone', () => {
  it('returns empty SceneData for unknown zone ID', () => {
    const scene = assembleSceneData('nonexistent-zone', chapel.project);
    expect(scene.background).toBeNull();
    expect(scene.tileset).toBeNull();
    expect(scene.entities).toHaveLength(0);
    expect(scene.light).toBe(0);
  });
});
