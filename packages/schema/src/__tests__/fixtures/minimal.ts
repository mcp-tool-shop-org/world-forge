// minimal.ts — smallest valid WorldProject: 2 zones, 1 district, 1 NPC, 1 spawn
import type { WorldProject } from '../../project.js';

export const minimalProject: WorldProject = {
  id: 'minimal-test',
  name: 'Minimal Test World',
  description: 'Two rooms connected by a door',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['dark'],
  difficulty: 'beginner',
  narratorTone: 'A weary narrator speaks of forgotten places.',

  map: {
    id: 'map-1',
    name: 'Test Map',
    description: 'A small test map',
    gridWidth: 20,
    gridHeight: 20,
    tileSize: 32,
  },

  zones: [
    {
      id: 'zone-entrance',
      name: 'Entrance Hall',
      tags: ['indoor', 'safe'],
      description: 'A dusty entrance hall with faded tapestries.',
      gridX: 0, gridY: 0, gridWidth: 10, gridHeight: 10,
      neighbors: ['zone-cellar'],
      exits: [{ targetZoneId: 'zone-cellar', label: 'trapdoor' }],
      light: 6, noise: 2,
      hazards: [],
      interactables: [{ name: 'old tapestry', type: 'inspect' }],
      parentDistrictId: 'district-chapel',
    },
    {
      id: 'zone-cellar',
      name: 'Cellar',
      tags: ['indoor', 'dark', 'underground'],
      description: 'A damp cellar beneath the hall.',
      gridX: 0, gridY: 10, gridWidth: 10, gridHeight: 10,
      neighbors: ['zone-entrance'],
      exits: [{ targetZoneId: 'zone-entrance', label: 'ladder up' }],
      light: 2, noise: 1,
      hazards: ['unstable-floor'],
      interactables: [],
      parentDistrictId: 'district-chapel',
    },
  ],

  connections: [
    { fromZoneId: 'zone-entrance', toZoneId: 'zone-cellar', label: 'trapdoor', bidirectional: true },
  ],

  districts: [
    {
      id: 'district-chapel',
      name: 'Chapel Quarter',
      zoneIds: ['zone-entrance', 'zone-cellar'],
      tags: ['sacred', 'old'],
      controllingFaction: 'keepers',
      baseMetrics: { commerce: 30, morale: 40, safety: 60, stability: 50 },
      economyProfile: { supplyCategories: ['food', 'medicine'], scarcityDefaults: { food: 0.3, medicine: 0.5 } },
    },
  ],

  landmarks: [
    {
      id: 'lm-altar',
      name: 'Cracked Altar',
      zoneId: 'zone-entrance',
      gridX: 5, gridY: 5,
      tags: ['sacred', 'interact'],
      description: 'A cracked stone altar.',
      interactionType: 'inspect',
    },
  ],

  factionPresences: [
    { factionId: 'keepers', districtIds: ['district-chapel'], influence: 70, alertLevel: 20 },
  ],

  pressureHotspots: [
    { id: 'ph-cellar', zoneId: 'zone-cellar', pressureType: 'undead-stirring', baseProbability: 0.3, tags: ['undead'] },
  ],

  playerTemplate: {
    name: 'Traveler',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: ['item-torch'],
    startingEquipment: {},
    spawnPointId: 'sp-default',
    tags: ['player'],
    custom: {},
  },

  progressionTrees: [],

  dialogues: [
    {
      id: 'dlg-keeper',
      speakers: ['keeper'],
      entryNodeId: 'greet',
      nodes: {
        greet: {
          id: 'greet',
          speaker: 'Keeper',
          text: 'Welcome, traveler.',
          choices: [
            { id: 'ask', text: 'What is this place?', nextNodeId: 'explain' },
            { id: 'bye', text: 'Farewell.', nextNodeId: 'end' },
          ],
        },
        explain: { id: 'explain', speaker: 'Keeper', text: 'An old chapel, nothing more.', nextNodeId: 'end' },
        end: { id: 'end', speaker: 'Keeper', text: 'Safe travels.' },
      },
    },
  ],

  entityPlacements: [
    { entityId: 'npc-keeper', zoneId: 'zone-entrance', role: 'npc', factionId: 'keepers', dialogueId: 'dlg-keeper' },
  ],

  itemPlacements: [
    { itemId: 'item-torch', zoneId: 'zone-cellar', container: 'shelf', hidden: false },
  ],

  encounterAnchors: [
    { id: 'enc-cellar', zoneId: 'zone-cellar', encounterType: 'undead', enemyIds: ['skeleton'], probability: 0.4, cooldownTurns: 3, tags: ['undead'] },
  ],

  spawnPoints: [
    { id: 'sp-default', zoneId: 'zone-entrance', gridX: 2, gridY: 2, isDefault: true },
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
