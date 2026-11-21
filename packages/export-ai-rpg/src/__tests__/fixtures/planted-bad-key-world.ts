// planted-bad-key-world.ts — test fixture worlds for engine gate verification.
// Provides a valid AI RPG baseline world and a companion world with one misspelt top-level key.

import type { WorldProject } from '@world-forge/schema';

export const validGateWorldProject: WorldProject = {
  id: 'valid-gate-world',
  name: 'Valid Gate World',
  description: 'Compact world valid across schema, export, engine load gate, and engine intake.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['dark'],
  difficulty: 'beginner',
  narratorTone: 'Stone chambers beneath an old watchtower.',
  map: {
    id: 'map-gate',
    name: 'Watchtower Vault',
    description: 'Two rooms for contract verification.',
    gridWidth: 20,
    gridHeight: 20,
    tileSize: 32,
  },
  zones: [
    {
      id: 'zone-entry',
      name: 'Watchtower Entry',
      tags: ['safe'],
      description: 'An arched stone hall.',
      gridX: 0,
      gridY: 0,
      gridWidth: 8,
      gridHeight: 8,
      neighbors: ['zone-vault'],
      exits: [{ targetZoneId: 'zone-vault', label: 'iron stair' }],
      light: 7,
      noise: 1,
      hazards: [],
      interactables: [],
      parentDistrictId: 'district-watch',
    },
    {
      id: 'zone-vault',
      name: 'Lower Vault',
      tags: ['dark'],
      description: 'Cold flagstones beneath the stair.',
      gridX: 0,
      gridY: 10,
      gridWidth: 8,
      gridHeight: 8,
      neighbors: ['zone-entry'],
      exits: [{ targetZoneId: 'zone-entry', label: 'stair up' }],
      light: 2,
      noise: 2,
      hazards: [],
      interactables: [],
      parentDistrictId: 'district-watch',
    },
  ],
  connections: [
    { fromZoneId: 'zone-entry', toZoneId: 'zone-vault', label: 'iron stair', bidirectional: true },
  ],
  districts: [
    {
      id: 'district-watch',
      name: 'Old Watch',
      zoneIds: ['zone-entry', 'zone-vault'],
      tags: ['stone'],
      baseMetrics: { commerce: 20, morale: 40, safety: 60, stability: 70 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    },
  ],
  landmarks: [],
  factionPresences: [],
  pressureHotspots: [],
  dialogues: [],
  progressionTrees: [],
  entityPlacements: [
    { entityId: 'npc-warden', zoneId: 'zone-entry', role: 'npc' },
    { entityId: 'enemy-sentry', zoneId: 'zone-vault', role: 'enemy' },
  ],
  itemPlacements: [],
  encounterAnchors: [
    { id: 'enc-vault', zoneId: 'zone-vault', encounterType: 'patrol', enemyIds: ['enemy-sentry'], probability: 0.5, cooldownTurns: 2, tags: [] },
  ],
  spawnPoints: [
    { id: 'sp-entry', zoneId: 'zone-entry', gridX: 2, gridY: 2, isDefault: true },
  ],
  craftingStations: [],
  marketNodes: [],
  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [],
  assets: [],
  assetPacks: [],
};

/** Valid world plus one deliberately misspelt top-level key (`stronghlds` instead of `strongholds`). */
export const plantedBadKeyWorldProject: WorldProject & { stronghlds: unknown[] } = {
  ...validGateWorldProject,
  id: 'planted-bad-key-world',
  name: 'Planted Bad Key World',
  stronghlds: [],
};
