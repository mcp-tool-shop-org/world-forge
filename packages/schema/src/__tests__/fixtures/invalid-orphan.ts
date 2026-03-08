// invalid-orphan.ts — deliberately broken project for validation testing
import type { WorldProject } from '../../project.js';

/** Project with broken cross-references. */
export const invalidOrphanProject: WorldProject = {
  id: 'invalid-test',
  name: 'Invalid Test World',
  description: 'A deliberately broken world for testing validation',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['dark'],
  difficulty: 'beginner',
  narratorTone: 'A confused narrator.',

  map: {
    id: 'map-1',
    name: 'Test Map',
    description: 'Broken map',
    gridWidth: 10,
    gridHeight: 10,
    tileSize: 32,
  },

  zones: [
    {
      id: 'zone-a',
      name: 'Room A',
      tags: [],
      description: 'A room.',
      gridX: 0, gridY: 0, gridWidth: 5, gridHeight: 5,
      neighbors: ['zone-nonexistent'],  // orphan neighbor
      exits: [],
      light: 5, noise: 0,
      hazards: [],
      interactables: [],
    },
  ],

  connections: [
    { fromZoneId: 'zone-a', toZoneId: 'zone-ghost', bidirectional: true },  // ghost zone
  ],

  districts: [
    {
      id: 'district-broken',
      name: 'Broken District',
      zoneIds: ['zone-a', 'zone-missing'],  // missing zone
      tags: [],
      baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    },
  ],

  landmarks: [
    { id: 'lm-ghost', name: 'Ghost Landmark', zoneId: 'zone-phantom', gridX: 0, gridY: 0, tags: [], interactionType: 'none' },
  ],

  factionPresences: [],
  pressureHotspots: [],

  dialogues: [],

  entityPlacements: [
    { entityId: 'npc-lost', zoneId: 'zone-void', role: 'npc' },  // invalid zone
  ],

  itemPlacements: [
    { itemId: 'item-lost', zoneId: 'zone-void', hidden: false },  // invalid zone
  ],

  encounterAnchors: [],
  spawnPoints: [],  // no spawn points

  craftingStations: [],
  marketNodes: [],
  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [],
};
