// genre-pirate.ts — Pirate starter template

import type { WorldProject } from '@world-forge/schema';

export const pirateTemplate: WorldProject = {
  id: 'pirate-starter',
  name: 'Pirate Starter',
  description: 'A lawless port where fortune favors the bold.',
  version: '0.1.0',
  genre: 'pirate',
  tones: ['adventurous', 'seafaring'],
  difficulty: 'beginner',
  narratorTone: 'Salt air, creaking wood, and the promise of gold.',

  map: { id: 'map-1', name: 'Port Havoc', description: 'A pirate haven built on stolen wealth.', gridWidth: 40, gridHeight: 30, tileSize: 32 },

  zones: [
    { id: 'docks', name: 'Docks', tags: ['port', 'open'], description: 'Ships bob in murky water. Crews load and unload under watchful eyes.', gridX: 5, gridY: 14, gridWidth: 8, gridHeight: 5, neighbors: ['tavern', 'hidden-cove'], exits: [], light: 7, noise: 6, hazards: [], interactables: [{ name: 'Harbor Board', type: 'inspect', description: 'Ship manifests and crew postings.' }], parentDistrictId: 'port-havoc' },
    { id: 'tavern', name: 'Tavern', tags: ['interior', 'social'], description: 'Rum, shanties, and sailors with loose tongues.', gridX: 16, gridY: 10, gridWidth: 7, gridHeight: 6, neighbors: ['docks', 'captains-quarters'], exits: [], light: 5, noise: 8, hazards: [], interactables: [{ name: 'Bar', type: 'talk', description: 'The barkeep trades drinks for secrets.' }], parentDistrictId: 'port-havoc' },
    { id: 'captains-quarters', name: "Captain's Quarters", tags: ['interior', 'restricted'], description: 'Maps, charts, and a locked chest of dubious origin.', gridX: 26, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['tavern'], exits: [], light: 6, noise: 1, hazards: [], interactables: [{ name: 'Sea Chart', type: 'inspect', description: 'A chart with an island circled in red ink.' }], parentDistrictId: 'port-havoc' },
    { id: 'hidden-cove', name: 'Hidden Cove', tags: ['outdoor', 'secret'], description: 'A secluded inlet, perfect for hiding cargo — or people.', gridX: 5, gridY: 22, gridWidth: 7, gridHeight: 5, neighbors: ['docks'], exits: [], light: 4, noise: 1, hazards: ['tide'], interactables: [{ name: 'Buried Cache', type: 'use', description: 'Freshly turned sand marks a recent burial.' }], parentDistrictId: 'port-havoc' },
  ],

  connections: [
    { fromZoneId: 'docks', toZoneId: 'tavern', bidirectional: true },
    { fromZoneId: 'docks', toZoneId: 'hidden-cove', bidirectional: true },
    { fromZoneId: 'tavern', toZoneId: 'captains-quarters', bidirectional: true },
  ],

  districts: [{
    id: 'port-havoc', name: 'Port Havoc',
    zoneIds: ['docks', 'tavern', 'captains-quarters', 'hidden-cove'],
    tags: ['port', 'lawless'],
    baseMetrics: { commerce: 75, morale: 50, safety: 25, stability: 20 },
    economyProfile: { supplyCategories: ['rum', 'weapons', 'contraband'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'dock-spawn', zoneId: 'docks', gridX: 8, gridY: 16, isDefault: true }],

  entityPlacements: [
    { entityId: 'first-mate', name: 'First Mate Briggs', zoneId: 'tavern', role: 'quest-giver', dialogueId: 'briggs-talk', tags: ['pirate', 'quest'] },
    { entityId: 'smuggler', name: 'Quiet Smuggler', zoneId: 'hidden-cove', role: 'merchant', tags: ['smuggler', 'merchant'] },
  ],

  dialogues: [{
    id: 'briggs-talk', speakers: ['briggs'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'briggs', text: 'New blood? The captain is looking for hands. Interested in a crew that pays well?', choices: [
        { id: 'c1', text: 'What is the job?', nextNodeId: 'offer' },
        { id: 'c2', text: 'I sail alone.', nextNodeId: 'farewell' },
      ]},
      offer: { id: 'offer', speaker: 'briggs', text: 'There is treasure on a reef island three days out. We need someone who can handle themselves. You in?', choices: [
        { id: 'c3', text: 'Count me in.', nextNodeId: 'farewell' },
        { id: 'c4', text: 'Let me think about it.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'briggs', text: 'We set sail at dawn. Do not be late.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Buccaneer',
    defaultArchetypeId: 'swashbuckler',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 6 },
    startingInventory: ['cutlass', 'compass'],
    startingEquipment: { weapon: 'cutlass' },
    spawnPointId: 'dock-spawn',
    tags: ['seafarer'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'swashbuckler', name: 'Swashbuckler', description: 'Quick blade, quicker wit.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['duelist'], progressionTreeId: 'sea-dog-path', grantedVerbs: ['parry', 'riposte'] },
      { id: 'navigator', name: 'Navigator', description: 'Reads the stars and the currents.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['wayfinder'], progressionTreeId: 'sea-dog-path', grantedVerbs: ['chart', 'spot'] },
    ],
    backgrounds: [
      { id: 'castaway', name: 'Castaway', description: 'Survived alone on a rock in the sea.', statModifiers: { vigor: 1 }, startingTags: ['survivor'] },
    ],
    traits: [
      { id: 'sea-legs', name: 'Sea Legs', description: 'Steady on any deck, in any storm.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'balanced' }] },
      { id: 'superstitious', name: 'Superstitious', description: 'Black cats, broken mirrors — you see omens everywhere.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'sea-dog-path', name: 'Sea Dog Path', currency: 'plunder',
    nodes: [
      { id: 'dirty-fighting', name: 'Dirty Fighting', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'cheap-shot' } }] },
      { id: 'captains-presence', name: "Captain's Presence", cost: 3, requires: ['dirty-fighting'], effects: [{ type: 'grant-tag', params: { tag: 'commanding' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'cutlass', name: 'Cutlass', description: 'A curved blade favored by sailors and scoundrels alike.', zoneId: 'docks', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'compass', name: 'Compass', description: 'A brass compass that always finds north — mostly.', zoneId: 'docks', hidden: false, slot: 'tool', rarity: 'uncommon', grantedTags: ['navigator'] },
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
};
