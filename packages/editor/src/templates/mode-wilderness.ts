// mode-wilderness.ts — Wilderness mode starter template

import type { WorldProject } from '@world-forge/schema';

export const wildernessStarter: WorldProject = {
  id: 'wilderness-starter',
  name: 'Wolf Ridge',
  description: 'A mountain trail through camp, cave, and ridge.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['rugged', 'primal'],
  difficulty: 'beginner',
  narratorTone: 'The wind carries the howl of something large and hungry.',
  mode: 'wilderness',

  map: { id: 'map-1', name: 'Wolf Ridge', description: 'A remote mountain trail through wild terrain.', gridWidth: 60, gridHeight: 50, tileSize: 48 },

  zones: [
    { id: 'base-camp', name: 'Area 1', tags: ['camp', 'safe'], description: 'A makeshift camp at the foot of the ridge.', gridX: 8, gridY: 20, gridWidth: 10, gridHeight: 8, neighbors: ['forest-trail', 'rocky-clearing'], exits: [], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Campfire', type: 'use', description: 'A stone-ringed fire pit with smoldering coals.' }], parentDistrictId: 'ridge-biome' },
    { id: 'forest-trail', name: 'Area 2', tags: ['clearing', 'danger'], description: 'A narrow trail through dense forest canopy.', gridX: 24, gridY: 14, gridWidth: 10, gridHeight: 6, neighbors: ['base-camp', 'wolf-cave'], exits: [], light: 3, noise: 1, hazards: ['wildlife'], interactables: [{ name: 'Animal Tracks', type: 'inspect', description: 'Large paw prints pressed deep into mud.' }], parentDistrictId: 'ridge-biome' },
    { id: 'rocky-clearing', name: 'Area 3', tags: ['ridge', 'exposed'], description: 'An open clearing atop the ridge with a wide view.', gridX: 14, gridY: 34, gridWidth: 12, gridHeight: 8, neighbors: ['base-camp'], exits: [], light: 9, noise: 5, hazards: ['exposure'], interactables: [{ name: 'Cairn', type: 'inspect', description: 'Stacked stones marking a boundary or a grave.' }], parentDistrictId: 'ridge-biome' },
    { id: 'wolf-cave', name: 'Area 4', tags: ['ravine', 'danger'], description: 'A shallow cave carved by water, now a beast den.', gridX: 40, gridY: 20, gridWidth: 8, gridHeight: 8, neighbors: ['forest-trail'], exits: [], light: 1, noise: 2, hazards: ['unstable-ground'], interactables: [{ name: 'Bone Pile', type: 'inspect', description: 'Gnawed bones scattered across the cave floor.' }], parentDistrictId: 'ridge-biome' },
  ],

  connections: [
    { fromZoneId: 'base-camp', toZoneId: 'forest-trail', bidirectional: true, kind: 'trail' },
    { fromZoneId: 'base-camp', toZoneId: 'rocky-clearing', bidirectional: true, kind: 'trail' },
    { fromZoneId: 'forest-trail', toZoneId: 'wolf-cave', bidirectional: true, kind: 'hazard' },
    { fromZoneId: 'rocky-clearing', toZoneId: 'wolf-cave', bidirectional: false, kind: 'passage' },
  ],

  districts: [{
    id: 'ridge-biome', name: 'Wolf Ridge',
    zoneIds: ['base-camp', 'forest-trail', 'rocky-clearing', 'wolf-cave'],
    tags: ['wilderness', 'mountainous'],
    baseMetrics: { commerce: 5, morale: 35, safety: 20, stability: 25 },
    economyProfile: { supplyCategories: ['pelts', 'herbs', 'firewood'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'camp-bedroll', zoneId: 'base-camp', gridX: 12, gridY: 23, isDefault: true }],

  entityPlacements: [
    { entityId: 'ranger-nara', name: 'Ranger Nara', zoneId: 'base-camp', role: 'quest-giver', dialogueId: 'nara-talk', tags: ['ranger', 'guide'] },
    { entityId: 'alpha-wolf', name: 'Alpha Wolf', zoneId: 'wolf-cave', role: 'enemy', tags: ['beast', 'territorial'] },
  ],

  dialogues: [{
    id: 'nara-talk', speakers: ['nara'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'nara', text: 'Keep your voice down. A pack of wolves has claimed the cave up the trail. The alpha is unusually aggressive.', choices: [
        { id: 'c1', text: 'How dangerous?', nextNodeId: 'details' },
        { id: 'c2', text: 'I will handle it.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'nara', text: 'The trail through the forest leads straight to their den. If you take the ridge path instead, you can approach from above — but the ground is exposed up there.', choices: [
        { id: 'c3', text: 'I will scout both routes.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'nara', text: 'Stay sharp. This is their territory, not ours.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Survivalist',
    defaultArchetypeId: 'tracker',
    baseStats: { vigor: 3, instinct: 4, will: 2 },
    baseResources: { hp: 9, stamina: 7 },
    startingInventory: ['hunting-knife', 'herb-pouch'],
    startingEquipment: { weapon: 'hunting-knife' },
    spawnPointId: 'camp-bedroll',
    tags: ['survivalist'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'tracker', name: 'Tracker', description: 'Reads the land like an open book.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['outdoor'], progressionTreeId: 'wild-path', grantedVerbs: ['track', 'forage'] },
      { id: 'beast-tamer', name: 'Beast Tamer', description: 'Understands animal behavior intimately.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['primal'], progressionTreeId: 'wild-path', grantedVerbs: ['calm-beast', 'lure'] },
    ],
    backgrounds: [
      { id: 'hermit', name: 'Hermit', description: 'You have lived alone in places like this.', statModifiers: { will: 1 }, startingTags: ['self-reliant'] },
    ],
    traits: [
      { id: 'beast-sense', name: 'Beast Sense', description: 'You can smell predators before they smell you.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'alert' }] },
      { id: 'soft-step', name: 'Soft Step', description: 'You struggle on rocky, uneven terrain.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'wild-path', name: 'Wild Path', currency: 'xp',
    nodes: [
      { id: 'predator-instinct', name: 'Predator Instinct', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'predator-sense' } }] },
      { id: 'alpha-challenge', name: 'Alpha Challenge', cost: 3, requires: ['predator-instinct'], effects: [{ type: 'grant-verb', params: { verb: 'challenge-alpha' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'hunting-knife', name: 'Hunting Knife', description: 'A keen blade for skinning and fighting.', zoneId: 'base-camp', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { instinct: 1 } },
    { itemId: 'herb-pouch', name: 'Herb Pouch', description: 'Foraged medicinal herbs for the trail.', zoneId: 'base-camp', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['herbalist'] },
  ],

  encounterAnchors: [
    { id: 'wolf-ambush', zoneId: 'forest-trail', encounterType: 'beast', enemyIds: ['alpha-wolf'], probability: 0.7, cooldownTurns: 2, tags: ['wildlife', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'ranger-corps', districtIds: ['ridge-biome'], influence: 40, alertLevel: 60 },
  ],

  pressureHotspots: [
    { id: 'predator-attack', zoneId: 'forest-trail', pressureType: 'predator-attack', baseProbability: 0.7, tags: ['wildlife'] },
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
