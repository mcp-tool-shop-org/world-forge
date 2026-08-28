import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportToEngine } from '../export.js';
import { importFromContentPack } from '../import.js';
import { createEmptyProject } from '@world-forge/schema';
import type { WorldProject, Landmark, LootTable, Stratum, TransitionEntity } from '@world-forge/schema';

function zone(id: string): WorldProject['zones'][number] {
  return {
    id, name: id, description: '', tags: [],
    gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
    neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
  };
}

function project(over: Partial<WorldProject>): WorldProject {
  const base = createEmptyProject();
  return {
    ...base,
    zones: [zone('z1'), zone('z2')],
    spawnPoints: [{ id: 'sp1', zoneId: 'z1', gridX: 0, gridY: 0, isDefault: true }],
    ...over,
  };
}

describe('F-3c90bcc5 landmarks converter', () => {
  it('round-trips landmark fields on ContentPack.landmarks', () => {
    const landmark: Landmark = {
      id: 'lm1', name: 'Tide Stone', zoneId: 'z1', gridX: 2, gridY: 3,
      tags: ['sacred'], description: 'A stone.', interactionType: 'inspect',
    };
    const result = exportToEngine(project({ landmarks: [landmark] }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.landmarks[0]).toMatchObject({
      id: 'lm1', name: 'Tide Stone', zoneId: 'z1', gridX: 2, gridY: 3, interactionType: 'inspect',
    });
    const back = importFromContentPack(result.contentPack);
    expect(back.success).toBe(true);
    if (!back.success) return;
    expect(back.project.landmarks[0].name).toBe('Tide Stone');
    expect(back.project.landmarks[0].zoneId).toBe('z1');
  });
});

describe('F-5dcb8b8a strata/transitions pack channel', () => {
  it('copies stratumId onto exported zones and pass-through strata/transitions', () => {
    const strata: Stratum[] = [{ id: 's1', name: 'Surface', order: 0, tags: [] }];
    const transitions: TransitionEntity[] = [{
      id: 't1', zoneId: 'z1', targetZoneId: 'z2', type: 'warp',
    }];
    const result = exportToEngine(project({
      zones: [{ ...zone('z1'), stratumId: 's1' }, zone('z2')],
      strata,
      stratumLinks: [{ id: 'l1', fromStratumId: 's1', toStratumId: 's1', bidirectional: true, linkType: 'stairs' }],
      transitions,
    }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.zones[0].stratumId).toBe('s1');
    expect(result.contentPack.strata).toHaveLength(1);
    expect(result.contentPack.transitions[0].type).toBe('warp');
    const back = importFromContentPack(result.contentPack);
    expect(back.success).toBe(true);
    if (!back.success) return;
    expect(back.project.strata?.[0].id).toBe('s1');
    expect(back.project.transitions?.[0].id).toBe('t1');
  });
});

describe('F-ef6779cc loot entry condition compile', () => {
  it('compiles loot entry conditions and decompiles on import', () => {
    const loot: LootTable[] = [{
      id: 'lt1',
      entries: [{ itemId: 'rope', weight: 1, condition: 'never' }],
    }];
    const result = exportToEngine(project({ lootTables: loot }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.lootTables[0].entries[0].condition).toEqual({ type: 'never', params: {} });
    const back = importFromContentPack(result.contentPack);
    expect(back.success).toBe(true);
    if (!back.success) return;
    expect(back.project.lootTables?.[0].entries[0].condition).toBe('never');
  });
});

describe('F-43fdcc72 CLI --verbose / --strict', () => {
  it('cli.ts documents and parses --verbose and --strict', () => {
    const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../cli.ts'), 'utf8');
    expect(text).toContain('--verbose');
    expect(text).toContain('--strict');
    expect(text).toContain("present.has('--strict')");
  });
});
