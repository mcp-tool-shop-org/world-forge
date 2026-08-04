// world-array-fields-validation.test.ts — F-001 (CRITICAL): craftingStations,
// marketNodes, tilesets, tileLayers, props, propPlacements, and ambientLayers
// are all REQUIRED WorldProject array fields (project.ts) that were entirely
// absent from validateProject's requiredArrays structural guard and received
// no id-uniqueness or cross-reference validation anywhere in the pipeline.
//
// Reproduced against the real validator: setting all seven to the wrong type
// entirely (a string, an object, ...) returned `{ valid: true, errors: [] }`.
// A sibling required field (zones) set the same way is correctly rejected —
// that asymmetry is the control proving the validator CAN detect this class
// and simply never reached these seven fields.

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';

describe('required-array structural guard — the seven previously-unguarded fields', () => {
  it('control: a known-good sibling (zones) set to a non-array is already rejected', () => {
    const bad = { ...minimalProject, zones: 'not-an-array' } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'zones')).toBe(true);
  });

  const FIELDS = [
    'craftingStations', 'marketNodes', 'tilesets', 'tileLayers',
    'props', 'propPlacements', 'ambientLayers',
  ] as const;

  for (const field of FIELDS) {
    it(`rejects ${field} set to the wrong type entirely`, () => {
      const bad = { ...minimalProject, [field]: 'not-an-array' } as unknown as WorldProject;
      const result = validateProject(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === field)).toBe(true);
    });
  }

  it('rejects all seven at once when corrupted to assorted wrong types (reproduces the audited repro)', () => {
    const bad = {
      ...minimalProject,
      craftingStations: 'not-an-array',
      marketNodes: { oops: true },
      tilesets: 42,
      tileLayers: null,
      props: 'nope',
      propPlacements: {},
      ambientLayers: 7,
    } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    for (const field of FIELDS) {
      expect(result.errors.some((e) => e.path === field)).toBe(true);
    }
  });

  it('accepts all seven fields as empty arrays (backward compatible — the minimal fixture shape)', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });
});

describe('id-uniqueness + cross-reference checks for the new array fields', () => {
  it('rejects duplicate crafting station IDs and a dangling zoneId', () => {
    const bad: WorldProject = {
      ...minimalProject,
      craftingStations: [
        { id: 'forge', zoneId: 'zone-entrance', stationType: 'smithing', availableRecipes: [] },
        { id: 'forge', zoneId: 'zone-ghost', stationType: 'smithing', availableRecipes: [] },
      ],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate crafting station ID'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('craftingStations') && e.message.includes('zone-ghost'))).toBe(true);
  });

  it('accepts a well-formed crafting station (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      craftingStations: [{ id: 'forge', zoneId: 'zone-entrance', stationType: 'smithing', availableRecipes: [] }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('rejects a market node with a dangling zoneId and merchantEntityId', () => {
    const bad: WorldProject = {
      ...minimalProject,
      marketNodes: [{
        id: 'mk1', zoneId: 'zone-ghost', merchantEntityId: 'npc-ghost',
        supplyCategories: [], priceModifier: 1, contrabandAvailable: false,
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('marketNodes') && e.message.includes('zone-ghost'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('marketNodes') && e.message.includes('npc-ghost'))).toBe(true);
  });

  it('accepts a market node referencing a real merchant entity (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      marketNodes: [{
        id: 'mk1', zoneId: 'zone-entrance', merchantEntityId: 'npc-keeper',
        supplyCategories: ['food'], priceModifier: 1, contrabandAvailable: false,
      }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('rejects duplicate tile definition IDs and a tile referencing a nonexistent tileset', () => {
    const bad: WorldProject = {
      ...minimalProject,
      tilesets: [
        {
          id: 'ts1', name: 'Stone', tileWidth: 32, tileHeight: 32,
          tiles: [
            { id: 'tile-a', tilesetId: 'ts-ghost', row: 0, col: 0, tags: [], walkable: true, opacity: 1 },
            { id: 'tile-a', tilesetId: 'ts1', row: 0, col: 1, tags: [], walkable: true, opacity: 1 },
          ],
        },
      ],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate tile definition ID'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('ts-ghost'))).toBe(true);
  });

  it('rejects duplicate tileset IDs', () => {
    const tileset = { id: 'ts1', name: 'Stone', tileWidth: 32, tileHeight: 32, tiles: [] };
    const bad: WorldProject = { ...minimalProject, tilesets: [tileset, { ...tileset }] };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate tileset ID'))).toBe(true);
  });

  it('rejects a tile layer placement referencing a nonexistent tile', () => {
    const bad: WorldProject = {
      ...minimalProject,
      tileLayers: [{ id: 'layer1', name: 'Ground', zIndex: 0, tiles: [{ tileId: 'ghost-tile', gridX: 0, gridY: 0 }] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('tileLayers') && e.message.includes('ghost-tile'))).toBe(true);
  });

  it('accepts a well-formed tileset + tile layer (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      tilesets: [{
        id: 'ts1', name: 'Stone', tileWidth: 32, tileHeight: 32,
        tiles: [{ id: 'tile-a', tilesetId: 'ts1', row: 0, col: 0, tags: [], walkable: true, opacity: 1 }],
      }],
      tileLayers: [{ id: 'layer1', name: 'Ground', zIndex: 0, tiles: [{ tileId: 'tile-a', gridX: 0, gridY: 0 }] }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('rejects a prop placement referencing a nonexistent prop definition and zone', () => {
    const bad: WorldProject = {
      ...minimalProject,
      propPlacements: [{ id: 'pp1', propId: 'ghost-prop', gridX: 0, gridY: 0, zoneId: 'zone-ghost' }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('propPlacements') && e.message.includes('ghost-prop'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('propPlacements') && e.message.includes('zone-ghost'))).toBe(true);
  });

  it('accepts a well-formed prop + placement (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      props: [{ id: 'barrel', name: 'Barrel', width: 1, height: 1, tags: [], walkable: false, interactable: false }],
      propPlacements: [{ id: 'pp1', propId: 'barrel', gridX: 0, gridY: 0, zoneId: 'zone-entrance' }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('accepts a prop placement with no zoneId (optional field, control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      props: [{ id: 'barrel', name: 'Barrel', width: 1, height: 1, tags: [], walkable: false, interactable: false }],
      propPlacements: [{ id: 'pp1', propId: 'barrel', gridX: 0, gridY: 0 }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('rejects an ambient layer referencing a nonexistent zone', () => {
    const bad: WorldProject = {
      ...minimalProject,
      ambientLayers: [{ id: 'fog1', name: 'Fog', zoneIds: ['zone-ghost'], type: 'fog', intensity: 0.5 }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('ambientLayers') && e.message.includes('zone-ghost'))).toBe(true);
  });

  it('accepts a well-formed ambient layer (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      ambientLayers: [{ id: 'fog1', name: 'Fog', zoneIds: ['zone-entrance'], type: 'fog', intensity: 0.5 }],
    };
    expect(validateProject(good).valid).toBe(true);
  });

  it('rejects duplicate market node, prop, prop-placement, and ambient-layer IDs', () => {
    const bad: WorldProject = {
      ...minimalProject,
      marketNodes: [
        { id: 'mk1', zoneId: 'zone-entrance', supplyCategories: [], priceModifier: 1, contrabandAvailable: false },
        { id: 'mk1', zoneId: 'zone-entrance', supplyCategories: [], priceModifier: 1, contrabandAvailable: false },
      ],
      props: [
        { id: 'p1', name: 'A', width: 1, height: 1, tags: [], walkable: false, interactable: false },
        { id: 'p1', name: 'B', width: 1, height: 1, tags: [], walkable: false, interactable: false },
      ],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate market node ID'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('Duplicate prop definition ID'))).toBe(true);
  });
});
