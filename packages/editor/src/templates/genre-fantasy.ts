// genre-fantasy.ts — Fantasy starter template

import type { WorldProject } from '@world-forge/schema';

export const fantasyTemplate: WorldProject = {
  id: 'fantasy-starter',
  name: 'Fantasy Starter',
  description: 'A small village on the edge of a dark forest.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['atmospheric', 'dark'],
  difficulty: 'beginner',
  narratorTone: 'The air smells of woodsmoke and old secrets.',

  map: { id: 'map-1', name: 'The Old Village', description: 'A quiet settlement with a looming forest.', gridWidth: 40, gridHeight: 30, tileSize: 32 },

  zones: [
    { id: 'village-square', name: 'Village Square', tags: ['town', 'safe'], description: 'The heart of the village, where paths converge.', gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6, neighbors: ['blacksmith', 'elder-hut', 'forest-edge'], exits: [], light: 8, noise: 3, hazards: [], interactables: [{ name: 'Notice Board', type: 'inspect', description: 'Weathered postings and wanted notices.' }], parentDistrictId: 'old-village' },
    { id: 'blacksmith', name: 'Blacksmith', tags: ['town', 'shop'], description: 'Heat and hammering fill this smoky workshop.', gridX: 20, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['village-square'], exits: [], light: 6, noise: 7, hazards: [], interactables: [{ name: 'Forge', type: 'use', description: 'A roaring forge for metalwork.' }], parentDistrictId: 'old-village' },
    { id: 'elder-hut', name: "Elder's Hut", tags: ['town', 'quest'], description: 'A crooked hut filled with books and dried herbs.', gridX: 10, gridY: 18, gridWidth: 5, gridHeight: 4, neighbors: ['village-square'], exits: [], light: 5, noise: 1, hazards: [], interactables: [{ name: 'Bookshelf', type: 'inspect', description: 'Dusty tomes in languages you half-recognize.' }], parentDistrictId: 'old-village' },
    { id: 'forest-edge', name: 'Forest Edge', tags: ['wilderness', 'danger'], description: 'Where the village ends and the dark forest begins.', gridX: 30, gridY: 14, gridWidth: 8, gridHeight: 6, neighbors: ['village-square'], exits: [], light: 3, noise: 2, hazards: ['wildlife'], interactables: [{ name: 'Trail Marker', type: 'inspect', description: 'A half-rotten signpost pointing deeper into the woods.' }], parentDistrictId: 'old-village' },
  ],

  connections: [
    { fromZoneId: 'village-square', toZoneId: 'blacksmith', bidirectional: true },
    { fromZoneId: 'village-square', toZoneId: 'elder-hut', bidirectional: true },
    { fromZoneId: 'village-square', toZoneId: 'forest-edge', bidirectional: true },
  ],

  districts: [{
    id: 'old-village', name: 'The Old Village',
    zoneIds: ['village-square', 'blacksmith', 'elder-hut', 'forest-edge'],
    tags: ['settlement'],
    baseMetrics: { commerce: 40, morale: 60, safety: 70, stability: 65 },
    economyProfile: { supplyCategories: ['provisions', 'arms'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'village-spawn', zoneId: 'village-square', gridX: 12, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'village-elder', name: 'Village Elder', zoneId: 'elder-hut', role: 'quest-giver', dialogueId: 'elder-talk', tags: ['elder', 'quest'] },
    { entityId: 'wandering-merchant', name: 'Wandering Merchant', zoneId: 'blacksmith', role: 'merchant', tags: ['merchant', 'traveler'] },
  ],

  dialogues: [{
    id: 'elder-talk', speakers: ['elder'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'elder', text: 'Ah, a new face. The forest grows restless. Will you hear an old man out?', choices: [
        { id: 'c1', text: 'Tell me more.', nextNodeId: 'quest' },
        { id: 'c2', text: 'Not now.', nextNodeId: 'farewell' },
      ]},
      quest: { id: 'quest', speaker: 'elder', text: 'Strange lights have been seen at the forest edge. Something stirs in the old ruins. Will you investigate?', choices: [
        { id: 'c3', text: 'I will look into it.', nextNodeId: 'farewell' },
        { id: 'c4', text: 'Sounds dangerous. Maybe later.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'elder', text: 'Safe travels, young one.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Adventurer',
    defaultArchetypeId: 'warrior',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: ['rustic-blade', 'healers-pouch'],
    startingEquipment: { weapon: 'rustic-blade' },
    spawnPointId: 'village-spawn',
    tags: ['newcomer'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'warrior', name: 'Warrior', description: 'A front-line fighter trained in arms.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['martial'], progressionTreeId: 'adventurer-path', grantedVerbs: ['strike', 'block'] },
      { id: 'mage', name: 'Mage', description: 'A student of the arcane arts.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['arcane'], progressionTreeId: 'adventurer-path', grantedVerbs: ['cast', 'ward'] },
    ],
    backgrounds: [
      { id: 'villager', name: 'Villager', description: 'Raised in a quiet settlement.', statModifiers: { instinct: 1 }, startingTags: ['local'] },
    ],
    traits: [
      { id: 'brave', name: 'Brave', description: 'You stand firm when others flee.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'courageous' }] },
      { id: 'clumsy', name: 'Clumsy', description: 'Your feet betray you at the worst times.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'instinct', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'adventurer-path', name: "Adventurer's Path", currency: 'xp',
    nodes: [
      { id: 'quick-reflexes', name: 'Quick Reflexes', cost: 2, effects: [{ type: 'stat-boost', params: { stat: 'instinct', amount: 1 } }] },
      { id: 'power-strike', name: 'Power Strike', cost: 3, requires: ['quick-reflexes'], effects: [{ type: 'grant-verb', params: { verb: 'power-strike' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'rustic-blade', name: 'Rustic Blade', description: 'A weathered short sword, still sharp enough.', zoneId: 'village-square', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'healers-pouch', name: "Healer's Pouch", description: 'Dried herbs and clean bandages.', zoneId: 'village-square', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['healer'] },
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
};
