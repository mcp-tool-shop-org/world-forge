// mode-ocean.ts — Ocean / Sea mode starter template

import type { WorldProject } from '@world-forge/schema';

export const oceanStarter: WorldProject = {
  id: 'ocean-starter',
  name: 'Corsair Strait',
  description: 'A contested trade lane between a harbor and a reef.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['adventurous', 'maritime'],
  difficulty: 'beginner',
  narratorTone: 'Salt spray stings your face as the hull cuts through dark water.',
  mode: 'ocean',

  map: { id: 'map-1', name: 'The Corsair Strait', description: 'Treacherous waters between harbor and open sea.', gridWidth: 60, gridHeight: 50, tileSize: 48 },

  zones: [
    { id: 'port-haven', name: 'Waters 1', tags: ['harbor', 'safe'], description: 'A fortified harbor town with a busy wharf.', gridX: 5, gridY: 20, gridWidth: 12, gridHeight: 10, neighbors: ['shipping-lane', 'reef-shallows'], exits: [], light: 8, noise: 6, hazards: [], interactables: [{ name: 'Harbor Master Post', type: 'inspect', description: 'Charts and tide tables cover the walls.' }], parentDistrictId: 'strait-waters' },
    { id: 'shipping-lane', name: 'Waters 2', tags: ['trade-lane'], description: 'The main channel for merchant vessels.', gridX: 22, gridY: 18, gridWidth: 14, gridHeight: 8, neighbors: ['port-haven', 'open-deep'], exits: [], light: 9, noise: 2, hazards: [], interactables: [{ name: 'Buoy Marker', type: 'inspect', description: 'A painted buoy marking the safe passage.' }], parentDistrictId: 'strait-waters' },
    { id: 'reef-shallows', name: 'Waters 3', tags: ['reef', 'danger'], description: 'Jagged coral barely visible beneath the surface.', gridX: 12, gridY: 34, gridWidth: 10, gridHeight: 8, neighbors: ['port-haven'], exits: [], light: 7, noise: 1, hazards: ['coral-scrape'], interactables: [{ name: 'Wrecked Hull', type: 'inspect', description: 'The rotting timbers of a vessel that found the reef.' }], parentDistrictId: 'strait-waters' },
    { id: 'open-deep', name: 'Waters 4', tags: ['deep-trench', 'pirate-water'], description: 'Open ocean where corsairs hunt merchant convoys.', gridX: 42, gridY: 16, gridWidth: 12, gridHeight: 12, neighbors: ['shipping-lane'], exits: [], light: 9, noise: 1, hazards: ['storm-risk'], interactables: [{ name: 'Floating Debris', type: 'inspect', description: 'Barrels and planks from a recent attack.' }], parentDistrictId: 'strait-waters' },
  ],

  connections: [
    { fromZoneId: 'port-haven', toZoneId: 'shipping-lane', bidirectional: true, kind: 'channel' },
    { fromZoneId: 'shipping-lane', toZoneId: 'open-deep', bidirectional: true, kind: 'route' },
    { fromZoneId: 'port-haven', toZoneId: 'reef-shallows', bidirectional: true, kind: 'hazard' },
    { fromZoneId: 'reef-shallows', toZoneId: 'open-deep', bidirectional: false, kind: 'route' },
  ],

  districts: [{
    id: 'strait-waters', name: 'Corsair Strait',
    zoneIds: ['port-haven', 'shipping-lane', 'reef-shallows', 'open-deep'],
    tags: ['maritime', 'contested'],
    baseMetrics: { commerce: 65, morale: 45, safety: 30, stability: 40 },
    economyProfile: { supplyCategories: ['fish', 'spice', 'timber'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'harbor-dock', zoneId: 'port-haven', gridX: 8, gridY: 24, isDefault: true }],

  entityPlacements: [
    { entityId: 'harbor-master', name: 'Harbor Master Lira', zoneId: 'port-haven', role: 'quest-giver', dialogueId: 'lira-talk', tags: ['authority', 'maritime'] },
    { entityId: 'corsair-scout', name: 'Corsair Scout', zoneId: 'open-deep', role: 'enemy', tags: ['pirate', 'hostile'] },
  ],

  dialogues: [{
    id: 'lira-talk', speakers: ['lira'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'lira', text: 'Another vessel lost to the corsairs last night. We need someone to chart their patrol routes.', choices: [
        { id: 'c1', text: 'Where do they strike?', nextNodeId: 'details' },
        { id: 'c2', text: 'Not my fight.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'lira', text: 'The open deep, past the shipping lane. They hide among the debris fields. Sail cautiously — the reef shallows are equally deadly.', choices: [
        { id: 'c3', text: 'I will scout the deep.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'lira', text: 'Fair winds, captain.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Captain',
    defaultArchetypeId: 'navigator',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 7 },
    startingInventory: ['cutlass', 'spyglass'],
    startingEquipment: { weapon: 'cutlass' },
    spawnPointId: 'harbor-dock',
    tags: ['sailor'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'navigator', name: 'Navigator', description: 'Reads wind and water like an open book.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['seafarer'], progressionTreeId: 'sea-path', grantedVerbs: ['navigate', 'spot'] },
      { id: 'buccaneer', name: 'Buccaneer', description: 'A blade in one hand, a rope in the other.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['martial'], progressionTreeId: 'sea-path', grantedVerbs: ['strike', 'board'] },
    ],
    backgrounds: [
      { id: 'dockhand', name: 'Dockhand', description: 'You grew up hauling cargo on the wharf.', statModifiers: { vigor: 1 }, startingTags: ['strong'] },
    ],
    traits: [
      { id: 'sea-legs', name: 'Sea Legs', description: 'You never lose your balance on deck.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'steady' }] },
      { id: 'superstitious', name: 'Superstitious', description: 'Bad omens haunt your every decision.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'sea-path', name: 'Sea Path', currency: 'fame',
    nodes: [
      { id: 'weather-eye', name: 'Weather Eye', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'storm-reader' } }] },
      { id: 'boarding-master', name: 'Boarding Master', cost: 3, requires: ['weather-eye'], effects: [{ type: 'grant-verb', params: { verb: 'board-vessel' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'cutlass', name: 'Cutlass', description: 'A curved blade favored by sailors.', zoneId: 'port-haven', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'spyglass', name: 'Spyglass', description: 'A brass telescope for scanning the horizon.', zoneId: 'port-haven', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['keen-eyed'] },
  ],

  encounterAnchors: [
    { id: 'pirate-raid', zoneId: 'open-deep', encounterType: 'pirate', enemyIds: ['corsair-scout'], probability: 0.6, cooldownTurns: 3, tags: ['maritime', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'harbor-authority', districtIds: ['strait-waters'], influence: 60, alertLevel: 50 },
  ],

  pressureHotspots: [
    { id: 'pirate-ambush', zoneId: 'open-deep', pressureType: 'pirate-raid', baseProbability: 0.7, tags: ['pirate'] },
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
