// genre-zombie.ts — Zombie starter template

import type { WorldProject } from '@world-forge/schema';

export const zombieTemplate: WorldProject = {
  id: 'zombie-starter',
  name: 'Zombie Starter',
  description: 'A fortified compound in a world overrun by the dead.',
  version: '0.1.0',
  genre: 'zombie',
  tones: ['tense', 'survival'],
  difficulty: 'beginner',
  narratorTone: 'Every sound could be the last one you hear.',

  map: { id: 'map-1', name: 'Safe House Compound', description: 'A hastily fortified block of buildings.', gridWidth: 40, gridHeight: 30, tileSize: 32 },

  zones: [
    { id: 'barricade', name: 'Barricade', tags: ['fortification', 'entry'], description: 'Scrap metal and overturned cars form the outer wall.', gridX: 5, gridY: 12, gridWidth: 7, gridHeight: 6, neighbors: ['supply-room', 'watchtower', 'breach-point'], exits: [], light: 5, noise: 3, hazards: [], interactables: [{ name: 'Reinforcement Point', type: 'use', description: 'Weak spot that could be shored up with materials.' }], parentDistrictId: 'compound' },
    { id: 'supply-room', name: 'Supply Room', tags: ['interior', 'storage'], description: 'Canned food, water bottles, and dwindling ammunition.', gridX: 16, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['barricade'], exits: [], light: 3, noise: 1, hazards: [], interactables: [{ name: 'Supply Crate', type: 'use', description: 'Inventory what remains.' }], parentDistrictId: 'compound' },
    { id: 'watchtower', name: 'Watchtower', tags: ['high-ground', 'lookout'], description: 'A makeshift platform with a view of the surrounding ruins.', gridX: 16, gridY: 20, gridWidth: 5, gridHeight: 4, neighbors: ['barricade'], exits: [], light: 7, noise: 1, hazards: ['exposed'], interactables: [{ name: 'Binoculars', type: 'inspect', description: 'Scan the horizon for movement.' }], parentDistrictId: 'compound' },
    { id: 'breach-point', name: 'Breach Point', tags: ['danger', 'compromised'], description: 'A section of wall that keeps giving way. They get in here.', gridX: 28, gridY: 14, gridWidth: 6, gridHeight: 6, neighbors: ['barricade'], exits: [], light: 2, noise: 5, hazards: ['undead', 'collapse'], interactables: [{ name: 'Damaged Wall', type: 'inspect', description: 'Claw marks. Fresh ones.' }], parentDistrictId: 'compound' },
  ],

  connections: [
    { fromZoneId: 'barricade', toZoneId: 'supply-room', bidirectional: true },
    { fromZoneId: 'barricade', toZoneId: 'watchtower', bidirectional: true },
    { fromZoneId: 'barricade', toZoneId: 'breach-point', bidirectional: true },
  ],

  districts: [{
    id: 'compound', name: 'Safe House Compound',
    zoneIds: ['barricade', 'supply-room', 'watchtower', 'breach-point'],
    tags: ['fortified', 'desperate'],
    baseMetrics: { commerce: 10, morale: 30, safety: 35, stability: 25 },
    economyProfile: { supplyCategories: ['scrap', 'medicine', 'ammo'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'compound-spawn', zoneId: 'barricade', gridX: 8, gridY: 14, isDefault: true }],

  entityPlacements: [
    { entityId: 'medic', name: 'Field Medic Shaw', zoneId: 'supply-room', role: 'companion', dialogueId: 'shaw-talk', tags: ['medic', 'ally'] },
    { entityId: 'shambler', name: 'Shambler', zoneId: 'breach-point', role: 'enemy', tags: ['undead', 'hostile'], stats: { vigor: 3, instinct: 1, will: 0 }, resources: { hp: 5 } },
  ],

  dialogues: [{
    id: 'shaw-talk', speakers: ['shaw'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'shaw', text: 'Supplies are running thin. We have maybe three days before we need to make a run.', choices: [
        { id: 'c1', text: 'Where should we look?', nextNodeId: 'plan' },
        { id: 'c2', text: 'We will manage.', nextNodeId: 'farewell' },
      ]},
      plan: { id: 'plan', speaker: 'shaw', text: 'The pharmacy on Fifth Street might still have antibiotics. But the streets between here and there... they are thick with them.', choices: [
        { id: 'c3', text: 'I will go.', nextNodeId: 'farewell' },
        { id: 'c4', text: 'Too dangerous right now.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'shaw', text: 'Be careful out there. We need you alive.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Survivor',
    defaultArchetypeId: 'scavenger',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: ['crowbar', 'first-aid-kit'],
    startingEquipment: { weapon: 'crowbar' },
    spawnPointId: 'compound-spawn',
    tags: ['survivor'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'scavenger', name: 'Scavenger', description: 'Finds what others overlook.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['resourceful'], progressionTreeId: 'survival-path', grantedVerbs: ['scavenge', 'craft'] },
      { id: 'brawler', name: 'Brawler', description: 'Hits hard with whatever is at hand.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['tough'], progressionTreeId: 'survival-path', grantedVerbs: ['bash', 'shove'] },
    ],
    backgrounds: [
      { id: 'paramedic', name: 'Former Paramedic', description: 'You kept people alive before the world ended.', statModifiers: { will: 1 }, startingTags: ['medical'] },
    ],
    traits: [
      { id: 'light-sleeper', name: 'Light Sleeper', description: 'You wake at the slightest sound.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'alert' }] },
      { id: 'anxious', name: 'Anxious', description: 'The tension never lets go.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'survival-path', name: 'Survival Path', currency: 'grit',
    nodes: [
      { id: 'field-medicine', name: 'Field Medicine', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'patch-up' } }] },
      { id: 'fortify', name: 'Fortify', cost: 3, requires: ['field-medicine'], effects: [{ type: 'grant-verb', params: { verb: 'barricade' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'crowbar', name: 'Crowbar', description: 'Pries open doors and skulls with equal ease.', zoneId: 'barricade', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'first-aid-kit', name: 'First Aid Kit', description: 'Basic medical supplies — gauze, antiseptic, painkillers.', zoneId: 'barricade', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['medic'] },
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
