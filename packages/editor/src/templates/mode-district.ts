// mode-district.ts — District / City mode starter template

import type { WorldProject } from '@world-forge/schema';

export const districtStarter: WorldProject = {
  id: 'district-starter',
  name: 'Market Quarter',
  description: 'A bustling city ward where trade and trouble collide.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['urban', 'lively'],
  difficulty: 'beginner',
  narratorTone: 'The sound of haggling and cart wheels fills the air.',
  mode: 'district',

  map: { id: 'map-1', name: 'The Market Quarter', description: 'A dense city ward built around a central plaza.', gridWidth: 50, gridHeight: 40, tileSize: 32 },

  zones: [
    { id: 'market-plaza', name: 'Block 1', tags: ['market', 'safe'], description: 'An open plaza crowded with stalls and hawkers.', gridX: 15, gridY: 14, gridWidth: 10, gridHeight: 8, neighbors: ['guild-hall', 'back-alley', 'chapel-lane'], exits: [], light: 9, noise: 8, hazards: [], interactables: [{ name: 'Fountain', type: 'inspect', description: 'A stone fountain at the center of the plaza.' }], parentDistrictId: 'market-ward' },
    { id: 'guild-hall', name: 'Block 2', tags: ['guild-ward', 'shop'], description: 'The merchant guild headquarters, richly appointed.', gridX: 30, gridY: 10, gridWidth: 8, gridHeight: 7, neighbors: ['market-plaza'], exits: [], light: 7, noise: 4, hazards: [], interactables: [{ name: 'Trade Ledger', type: 'inspect', description: 'Thick ledger books track every shipment.' }], parentDistrictId: 'market-ward' },
    { id: 'back-alley', name: 'Block 3', tags: ['slum', 'danger'], description: 'Narrow alleys behind the market, reeking of refuse.', gridX: 5, gridY: 18, gridWidth: 6, gridHeight: 6, neighbors: ['market-plaza'], exits: [], light: 3, noise: 2, hazards: [], interactables: [{ name: 'Discarded Crate', type: 'inspect', description: 'Someone left this here in a hurry.' }], parentDistrictId: 'market-ward' },
    { id: 'chapel-lane', name: 'Block 4', tags: ['chapel', 'safe'], description: 'A quiet lane leading to a small neighborhood shrine.', gridX: 20, gridY: 26, gridWidth: 7, gridHeight: 5, neighbors: ['market-plaza'], exits: [], light: 7, noise: 1, hazards: [], interactables: [{ name: 'Shrine Candles', type: 'use', description: 'Votives flicker in the alcove.' }], parentDistrictId: 'market-ward' },
  ],

  connections: [
    { fromZoneId: 'market-plaza', toZoneId: 'guild-hall', bidirectional: true, kind: 'road' },
    { fromZoneId: 'market-plaza', toZoneId: 'back-alley', bidirectional: true, kind: 'road' },
    { fromZoneId: 'market-plaza', toZoneId: 'chapel-lane', bidirectional: true, kind: 'road' },
    { fromZoneId: 'back-alley', toZoneId: 'guild-hall', bidirectional: true, kind: 'door' },
  ],

  districts: [{
    id: 'market-ward', name: 'The Market Ward',
    zoneIds: ['market-plaza', 'guild-hall', 'back-alley', 'chapel-lane'],
    tags: ['commerce', 'urban'],
    baseMetrics: { commerce: 85, morale: 60, safety: 50, stability: 65 },
    economyProfile: { supplyCategories: ['provisions', 'luxury-goods', 'arms'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'plaza-gate', zoneId: 'market-plaza', gridX: 18, gridY: 17, isDefault: true }],

  entityPlacements: [
    { entityId: 'guild-master', name: 'Guild Master Voss', zoneId: 'guild-hall', role: 'quest-giver', dialogueId: 'voss-talk', tags: ['merchant', 'authority'] },
    { entityId: 'street-urchin', name: 'Street Urchin', zoneId: 'back-alley', role: 'npc', tags: ['informant', 'street'] },
  ],

  dialogues: [{
    id: 'voss-talk', speakers: ['voss'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'voss', text: 'Welcome to the guild hall. We could use someone capable — shipments have been going missing.', choices: [
        { id: 'c1', text: 'What kind of shipments?', nextNodeId: 'details' },
        { id: 'c2', text: 'Not my problem.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'voss', text: 'Crates of silks from the eastern road. The back alleys are the likely transfer point. Find out who is behind it.', choices: [
        { id: 'c3', text: 'I will look into it.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'voss', text: 'Good. Report back here when you have something.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Drifter',
    defaultArchetypeId: 'investigator',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 6 },
    startingInventory: ['city-blade', 'coinpurse'],
    startingEquipment: { weapon: 'city-blade' },
    spawnPointId: 'plaza-gate',
    tags: ['outsider'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'investigator', name: 'Investigator', description: 'Reads people and places with equal skill.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['perceptive'], progressionTreeId: 'city-path', grantedVerbs: ['investigate', 'persuade'] },
      { id: 'enforcer', name: 'Enforcer', description: 'Solves problems with presence and force.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['intimidating'], progressionTreeId: 'city-path', grantedVerbs: ['strike', 'intimidate'] },
    ],
    backgrounds: [
      { id: 'street-born', name: 'Street-Born', description: 'You grew up in alleys like these.', statModifiers: { instinct: 1 }, startingTags: ['street-wise'] },
    ],
    traits: [
      { id: 'silver-tongue', name: 'Silver Tongue', description: 'Your words open doors that keys cannot.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'eloquent' }] },
      { id: 'wanted', name: 'Wanted', description: 'Someone in this city wants you found.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'city-path', name: 'City Path', currency: 'rep',
    nodes: [
      { id: 'street-contacts', name: 'Street Contacts', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'connected' } }] },
      { id: 'blackmail', name: 'Blackmail', cost: 3, requires: ['street-contacts'], effects: [{ type: 'grant-verb', params: { verb: 'blackmail' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'city-blade', name: 'City Blade', description: 'A slim rapier suited for urban dueling.', zoneId: 'market-plaza', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { instinct: 1 } },
    { itemId: 'coinpurse', name: 'Coinpurse', description: 'A pouch of mixed silver and copper.', zoneId: 'market-plaza', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['funded'] },
  ],

  encounterAnchors: [
    { id: 'alley-brawl', zoneId: 'back-alley', encounterType: 'brawl', enemyIds: [], probability: 0.5, cooldownTurns: 4, tags: ['urban', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'merchant-guild', districtIds: ['market-ward'], influence: 75, alertLevel: 30 },
  ],

  pressureHotspots: [
    { id: 'alley-theft', zoneId: 'back-alley', pressureType: 'pickpocket', baseProbability: 0.5, tags: ['crime'] },
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
