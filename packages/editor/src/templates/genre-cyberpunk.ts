// genre-cyberpunk.ts — Cyberpunk starter template

import type { WorldProject } from '@world-forge/schema';

export const cyberpunkTemplate: WorldProject = {
  id: 'cyberpunk-starter',
  name: 'Cyberpunk Starter',
  description: 'A neon-soaked district ruled by data and desperation.',
  version: '0.1.0',
  genre: 'cyberpunk',
  tones: ['gritty', 'neon'],
  difficulty: 'beginner',
  narratorTone: 'Rain streaks the holographic billboards. Everything has a price.',

  map: { id: 'map-1', name: 'Neon Alley', description: 'A dense block of back-streets and black markets.', gridWidth: 40, gridHeight: 30, tileSize: 32 },

  zones: [
    { id: 'back-alley', name: 'Back Alley', tags: ['urban', 'dark'], description: 'Puddles reflect neon. The smell of ozone and cheap ramen.', gridX: 10, gridY: 12, gridWidth: 7, gridHeight: 5, neighbors: ['hacker-den', 'black-market', 'rooftop'], exits: [], light: 3, noise: 5, hazards: [], interactables: [{ name: 'Dumpster Terminal', type: 'inspect', description: 'A cracked screen displaying garbled data.' }], parentDistrictId: 'neon-district' },
    { id: 'hacker-den', name: 'Hacker Den', tags: ['tech', 'hidden'], description: 'Screens everywhere, cables like vines. Someone lives here.', gridX: 20, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['back-alley'], exits: [], light: 4, noise: 2, hazards: [], interactables: [{ name: 'Server Rack', type: 'use', description: 'Blinking LEDs and the hum of raw processing power.' }], parentDistrictId: 'neon-district' },
    { id: 'black-market', name: 'Black Market', tags: ['commerce', 'illegal'], description: 'Stalls of contraband under flickering strip lights.', gridX: 10, gridY: 20, gridWidth: 8, gridHeight: 5, neighbors: ['back-alley'], exits: [], light: 5, noise: 6, hazards: [], interactables: [{ name: 'Vendor Stall', type: 'use', description: 'Augmentations, weapons, and things best left unasked.' }], parentDistrictId: 'neon-district' },
    { id: 'rooftop', name: 'Rooftop', tags: ['high-ground', 'exposed'], description: 'Wind whips between antenna arrays. The city stretches out below.', gridX: 28, gridY: 8, gridWidth: 6, gridHeight: 4, neighbors: ['back-alley'], exits: [], light: 6, noise: 1, hazards: ['fall'], interactables: [{ name: 'Antenna Relay', type: 'inspect', description: 'Could be used to boost a signal — or intercept one.' }], parentDistrictId: 'neon-district' },
  ],

  connections: [
    { fromZoneId: 'back-alley', toZoneId: 'hacker-den', bidirectional: true },
    { fromZoneId: 'back-alley', toZoneId: 'black-market', bidirectional: true },
    { fromZoneId: 'back-alley', toZoneId: 'rooftop', bidirectional: true },
  ],

  districts: [{
    id: 'neon-district', name: 'Neon Alley',
    zoneIds: ['back-alley', 'hacker-den', 'black-market', 'rooftop'],
    tags: ['urban', 'lawless'],
    baseMetrics: { commerce: 70, morale: 25, safety: 20, stability: 30 },
    economyProfile: { supplyCategories: ['tech', 'weapons', 'augments'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'alley-spawn', zoneId: 'back-alley', gridX: 12, gridY: 14, isDefault: true }],

  entityPlacements: [
    { entityId: 'info-broker', name: 'Info Broker', zoneId: 'hacker-den', role: 'quest-giver', dialogueId: 'broker-talk', tags: ['hacker', 'quest'] },
    { entityId: 'rogue-drone', name: 'Rogue Drone', zoneId: 'rooftop', role: 'enemy', tags: ['machine', 'hostile'], stats: { vigor: 2, instinct: 5, will: 1 }, resources: { hp: 6 } },
  ],

  dialogues: [{
    id: 'broker-talk', speakers: ['broker'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'broker', text: 'You look like someone who needs information. I sell that.', choices: [
        { id: 'c1', text: 'What do you know?', nextNodeId: 'offer' },
        { id: 'c2', text: 'Wrong person.', nextNodeId: 'farewell' },
      ]},
      offer: { id: 'offer', speaker: 'broker', text: 'There is a corporate data cache on the rooftop relay. Crack it and we split the take. Interested?', choices: [
        { id: 'c3', text: 'Deal.', nextNodeId: 'farewell' },
        { id: 'c4', text: 'Too risky.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'broker', text: 'You know where to find me.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Runner',
    defaultArchetypeId: 'netrunner',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 6 },
    startingInventory: ['shock-baton', 'data-shard'],
    startingEquipment: { weapon: 'shock-baton' },
    spawnPointId: 'alley-spawn',
    tags: ['street'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'netrunner', name: 'Netrunner', description: 'A digital infiltrator who bends networks to their will.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['hacker'], progressionTreeId: 'cyberware-path', grantedVerbs: ['hack', 'scan'] },
      { id: 'street-samurai', name: 'Street Samurai', description: 'Augmented muscle trained for close combat.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['augmented'], progressionTreeId: 'cyberware-path', grantedVerbs: ['slash', 'dodge'] },
    ],
    backgrounds: [
      { id: 'corp-dropout', name: 'Corporate Dropout', description: 'You walked away from the machine.', statModifiers: { will: 1 }, startingTags: ['ex-corp'] },
    ],
    traits: [
      { id: 'wired-reflexes', name: 'Wired Reflexes', description: 'Neural boosters shave milliseconds off your reaction time.', category: 'perk', effects: [{ type: 'stat-modifier', stat: 'instinct', amount: 1 }] },
      { id: 'glitchy', name: 'Glitchy', description: 'Cheap implants misfire under stress.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'cyberware-path', name: 'Cyberware Path', currency: 'cred',
    nodes: [
      { id: 'optic-boost', name: 'Optic Boost', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'enhanced-sight' } }] },
      { id: 'reflex-amp', name: 'Reflex Amplifier', cost: 3, requires: ['optic-boost'], effects: [{ type: 'stat-boost', params: { stat: 'instinct', amount: 1 } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'shock-baton', name: 'Shock Baton', description: 'A retractable stun rod with a flickering charge.', zoneId: 'back-alley', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'data-shard', name: 'Data Shard', description: 'A cracked memory chip with encrypted fragments.', zoneId: 'back-alley', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['data-carrier'] },
  ],
  encounterAnchors: [],
  factionPresences: [],
  pressureHotspots: [],
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
