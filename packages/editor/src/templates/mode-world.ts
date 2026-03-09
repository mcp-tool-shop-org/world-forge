// mode-world.ts — Region / World mode starter template

import type { WorldProject } from '@world-forge/schema';

export const worldStarter: WorldProject = {
  id: 'world-starter',
  name: 'Contested Frontier',
  description: 'A border territory between rival kingdoms.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['epic', 'political'],
  difficulty: 'beginner',
  narratorTone: 'The horizon stretches in every direction, claimed by none.',
  mode: 'world',

  map: { id: 'map-1', name: 'The Contested Frontier', description: 'A vast borderland between two rival kingdoms.', gridWidth: 80, gridHeight: 60, tileSize: 48 },

  zones: [
    { id: 'northern-realm', name: 'Territory 1', tags: ['kingdom', 'safe'], description: 'The prosperous heartland of the northern crown.', gridX: 20, gridY: 8, gridWidth: 14, gridHeight: 10, neighbors: ['frontier-pass', 'sacred-grove'], exits: [], light: 8, noise: 4, hazards: [], interactables: [{ name: 'Border Stone', type: 'inspect', description: 'An ancient marker defining the northern claim.' }], parentDistrictId: 'borderlands' },
    { id: 'frontier-pass', name: 'Territory 2', tags: ['frontier', 'danger'], description: 'A contested mountain pass where borders blur.', gridX: 30, gridY: 24, gridWidth: 12, gridHeight: 8, neighbors: ['northern-realm', 'southern-realm'], exits: [], light: 6, noise: 3, hazards: ['bandits'], interactables: [{ name: 'Watchtower Ruins', type: 'inspect', description: 'A crumbled watchtower from a forgotten treaty.' }], parentDistrictId: 'borderlands' },
    { id: 'southern-realm', name: 'Territory 3', tags: ['kingdom', 'safe'], description: 'The arid domain of the southern warlord.', gridX: 24, gridY: 40, gridWidth: 14, gridHeight: 10, neighbors: ['frontier-pass'], exits: [], light: 9, noise: 2, hazards: [], interactables: [{ name: 'War Banner', type: 'inspect', description: 'A torn banner staked into the dry earth.' }], parentDistrictId: 'borderlands' },
    { id: 'sacred-grove', name: 'Territory 4', tags: ['sacred-region', 'forest'], description: 'An ancient grove claimed by neither kingdom.', gridX: 50, gridY: 16, gridWidth: 10, gridHeight: 10, neighbors: ['northern-realm'], exits: [], light: 4, noise: 1, hazards: [], interactables: [{ name: 'Druid Circle', type: 'use', description: 'Standing stones hum with old power.' }], parentDistrictId: 'borderlands' },
  ],

  connections: [
    { fromZoneId: 'northern-realm', toZoneId: 'frontier-pass', bidirectional: true, kind: 'road' },
    { fromZoneId: 'frontier-pass', toZoneId: 'southern-realm', bidirectional: true, kind: 'road' },
    { fromZoneId: 'northern-realm', toZoneId: 'sacred-grove', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'sacred-grove', toZoneId: 'frontier-pass', bidirectional: false, kind: 'portal' },
  ],

  districts: [{
    id: 'borderlands', name: 'The Borderlands',
    zoneIds: ['northern-realm', 'frontier-pass', 'southern-realm', 'sacred-grove'],
    tags: ['contested', 'frontier'],
    baseMetrics: { commerce: 35, morale: 40, safety: 30, stability: 25 },
    economyProfile: { supplyCategories: ['arms', 'provisions', 'horses'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'northern-gate', zoneId: 'northern-realm', gridX: 25, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'border-captain', name: 'Border Captain Thane', zoneId: 'frontier-pass', role: 'quest-giver', dialogueId: 'thane-talk', tags: ['military', 'authority'] },
    { entityId: 'caravan-master', name: 'Caravan Master', zoneId: 'northern-realm', role: 'merchant', tags: ['trader', 'traveler'] },
  ],

  dialogues: [{
    id: 'thane-talk', speakers: ['thane'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'thane', text: 'You picked a bad time to cross the frontier. Caravan raids have doubled this season.', choices: [
        { id: 'c1', text: 'Who is behind the raids?', nextNodeId: 'details' },
        { id: 'c2', text: 'I can handle myself.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'thane', text: 'Southern outriders, or so we think. The pass is the bottleneck — control it and you control the trade.', choices: [
        { id: 'c3', text: 'I will scout the pass.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'thane', text: 'Watch your back out there.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Wanderer',
    defaultArchetypeId: 'ranger',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 6 },
    startingInventory: ['travel-sword', 'rations-pack'],
    startingEquipment: { weapon: 'travel-sword' },
    spawnPointId: 'northern-gate',
    tags: ['traveler'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'ranger', name: 'Ranger', description: 'A wilderness-hardened scout and tracker.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['outdoor'], progressionTreeId: 'frontier-path', grantedVerbs: ['track', 'forage'] },
      { id: 'diplomat', name: 'Diplomat', description: 'Resolves conflict with words before swords.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['persuasive'], progressionTreeId: 'frontier-path', grantedVerbs: ['negotiate', 'rally'] },
    ],
    backgrounds: [
      { id: 'border-guard', name: 'Border Guard', description: 'You patrolled these lands once.', statModifiers: { vigor: 1 }, startingTags: ['veteran'] },
    ],
    traits: [
      { id: 'pathfinder', name: 'Pathfinder', description: 'You always find the shortest route.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'navigator' }] },
      { id: 'outsider', name: 'Outsider', description: 'Neither kingdom trusts you fully.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'frontier-path', name: 'Frontier Path', currency: 'xp',
    nodes: [
      { id: 'terrain-mastery', name: 'Terrain Mastery', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'sure-footed' } }] },
      { id: 'ambush-tactics', name: 'Ambush Tactics', cost: 3, requires: ['terrain-mastery'], effects: [{ type: 'grant-verb', params: { verb: 'ambush' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'travel-sword', name: 'Travel Sword', description: 'A reliable blade for the open road.', zoneId: 'northern-realm', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'rations-pack', name: 'Rations Pack', description: 'Dried meat and hardtack for the journey.', zoneId: 'northern-realm', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['provisioned'] },
  ],

  encounterAnchors: [
    { id: 'caravan-ambush', zoneId: 'frontier-pass', encounterType: 'caravan-raid', enemyIds: [], probability: 0.5, cooldownTurns: 5, tags: ['military', 'large-scale'] },
  ],

  factionPresences: [
    { factionId: 'northern-crown', districtIds: ['borderlands'], influence: 55, alertLevel: 40 },
  ],

  pressureHotspots: [
    { id: 'pass-skirmish', zoneId: 'frontier-pass', pressureType: 'border-conflict', baseProbability: 0.6, tags: ['military'] },
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
