// mode-interior.ts — Interior mode starter template

import type { WorldProject } from '@world-forge/schema';

export const interiorStarter: WorldProject = {
  id: 'interior-starter',
  name: 'Clockwork Manor',
  description: 'A multi-floor manor house hiding mechanical secrets.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['mysterious', 'gothic'],
  difficulty: 'beginner',
  narratorTone: 'Gears click behind the walls. The house is never quite still.',
  mode: 'interior',

  map: { id: 'map-1', name: 'The Clockwork Manor', description: 'A sprawling manor with hidden passages.', gridWidth: 20, gridHeight: 15, tileSize: 24 },

  zones: [
    { id: 'grand-foyer', name: 'Room 1', tags: ['room', 'safe'], description: 'A dusty entrance hall with a grand staircase.', gridX: 6, gridY: 2, gridWidth: 5, gridHeight: 4, neighbors: ['parlor', 'cellar', 'study'], exits: [], light: 5, noise: 1, hazards: [], interactables: [{ name: 'Grandfather Clock', type: 'inspect', description: 'Still ticking, though the hands move in the wrong direction.' }], parentDistrictId: 'manor-ground' },
    { id: 'parlor', name: 'Room 2', tags: ['room'], description: 'A sitting room with covered furniture and faded portraits.', gridX: 13, gridY: 2, gridWidth: 5, gridHeight: 4, neighbors: ['grand-foyer'], exits: [], light: 4, noise: 0, hazards: [], interactables: [{ name: 'Portrait Gallery', type: 'inspect', description: 'The eyes in the portraits seem to follow you.' }], parentDistrictId: 'manor-ground' },
    { id: 'cellar', name: 'Room 3', tags: ['cellar', 'danger'], description: 'A damp cellar with mechanisms built into the walls.', gridX: 6, gridY: 9, gridWidth: 5, gridHeight: 4, neighbors: ['grand-foyer'], exits: [], light: 1, noise: 3, hazards: ['unstable-mechanism'], interactables: [{ name: 'Gear Assembly', type: 'use', description: 'Interlocking brass gears attached to hidden chains.' }], parentDistrictId: 'manor-ground' },
    { id: 'study', name: 'Room 4', tags: ['room', 'quest'], description: 'A private study concealed behind a false bookcase.', gridX: 1, gridY: 5, gridWidth: 4, gridHeight: 4, neighbors: ['grand-foyer'], exits: [], light: 3, noise: 0, hazards: [], interactables: [{ name: 'Locked Desk', type: 'use', description: 'A heavy oak desk with an intricate lock.' }], parentDistrictId: 'manor-ground' },
  ],

  connections: [
    { fromZoneId: 'grand-foyer', toZoneId: 'parlor', bidirectional: true, kind: 'door' },
    { fromZoneId: 'grand-foyer', toZoneId: 'cellar', bidirectional: true, kind: 'stairs' },
    { fromZoneId: 'grand-foyer', toZoneId: 'study', bidirectional: true, kind: 'secret' },
    { fromZoneId: 'cellar', toZoneId: 'study', bidirectional: false, kind: 'passage' },
  ],

  districts: [{
    id: 'manor-ground', name: 'Ground Floor',
    zoneIds: ['grand-foyer', 'parlor', 'cellar', 'study'],
    tags: ['indoor', 'gothic'],
    baseMetrics: { commerce: 0, morale: 30, safety: 40, stability: 50 },
    economyProfile: { supplyCategories: ['books', 'mechanisms'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'front-door', zoneId: 'grand-foyer', gridX: 8, gridY: 4, isDefault: true }],

  entityPlacements: [
    { entityId: 'old-caretaker', name: 'Old Caretaker', zoneId: 'grand-foyer', role: 'npc', dialogueId: 'caretaker-talk', tags: ['resident', 'nervous'] },
    { entityId: 'clockwork-sentinel', name: 'Clockwork Sentinel', zoneId: 'cellar', role: 'enemy', tags: ['construct', 'guardian'] },
  ],

  dialogues: [{
    id: 'caretaker-talk', speakers: ['caretaker'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'caretaker', text: 'You should not be here. The manor... it does not welcome visitors. Things move in the walls.', choices: [
        { id: 'c1', text: 'What moves in the walls?', nextNodeId: 'explain' },
        { id: 'c2', text: 'I will take my chances.', nextNodeId: 'farewell' },
      ]},
      explain: { id: 'explain', speaker: 'caretaker', text: 'The old lord built machines into the foundations. Gears, springs, guardians. The study holds his notes, but it is hidden — behind the bookcase in the foyer.', choices: [
        { id: 'c3', text: 'I will find it.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'caretaker', text: 'Be careful. The cellar is the worst of it.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Investigator',
    defaultArchetypeId: 'sleuth',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 7, stamina: 6 },
    startingInventory: ['candlestick', 'pocket-watch'],
    startingEquipment: { weapon: 'candlestick' },
    spawnPointId: 'front-door',
    tags: ['visitor'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'sleuth', name: 'Sleuth', description: 'Observes details others miss.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['perceptive'], progressionTreeId: 'manor-path', grantedVerbs: ['search', 'deduce'] },
      { id: 'tinker', name: 'Tinker', description: 'Understands mechanisms and clockwork.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['mechanical'], progressionTreeId: 'manor-path', grantedVerbs: ['repair', 'disarm'] },
    ],
    backgrounds: [
      { id: 'antiquarian', name: 'Antiquarian', description: 'Old things tell you their stories.', statModifiers: { will: 1 }, startingTags: ['learned'] },
    ],
    traits: [
      { id: 'keen-ear', name: 'Keen Ear', description: 'You hear the tick of hidden mechanisms.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'attentive' }] },
      { id: 'nervous', name: 'Nervous', description: 'Every creak in the manor sets you on edge.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'manor-path', name: 'Manor Path', currency: 'insight',
    nodes: [
      { id: 'hidden-passages', name: 'Hidden Passages', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'secret-finder' } }] },
      { id: 'clockwork-mastery', name: 'Clockwork Mastery', cost: 3, requires: ['hidden-passages'], effects: [{ type: 'grant-verb', params: { verb: 'override-mechanism' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'candlestick', name: 'Heavy Candlestick', description: 'Silver and sturdy enough to use as a weapon.', zoneId: 'grand-foyer', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'pocket-watch', name: 'Pocket Watch', description: 'Ticks in sync with the manor mechanisms.', zoneId: 'grand-foyer', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['time-sense'] },
  ],

  encounterAnchors: [
    { id: 'cellar-haunt', zoneId: 'cellar', encounterType: 'haunt', enemyIds: ['clockwork-sentinel'], probability: 0.6, cooldownTurns: 3, tags: ['supernatural', 'mechanical'] },
  ],

  factionPresences: [
    { factionId: 'manor-mechanisms', districtIds: ['manor-ground'], influence: 90, alertLevel: 40 },
  ],

  pressureHotspots: [
    { id: 'mechanism-surge', zoneId: 'cellar', pressureType: 'trap-activation', baseProbability: 0.5, tags: ['mechanical'] },
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
