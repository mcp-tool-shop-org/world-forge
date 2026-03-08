// genre-detective.ts — Detective starter template

import type { WorldProject } from '@world-forge/schema';

export const detectiveTemplate: WorldProject = {
  id: 'detective-starter',
  name: 'Detective Starter',
  description: 'A noir investigation in a city that never sleeps.',
  version: '0.1.0',
  genre: 'detective',
  tones: ['noir', 'suspenseful'],
  difficulty: 'beginner',
  narratorTone: 'The rain does not care about the dead. Neither does the city.',

  map: { id: 'map-1', name: 'Downtown Precinct', description: 'Fog, streetlamps, and the stale scent of cold cases.', gridWidth: 40, gridHeight: 30, tileSize: 32 },

  zones: [
    { id: 'office', name: 'Detective Office', tags: ['interior', 'safe'], description: 'A cramped office. Case files cover every surface.', gridX: 8, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['crime-scene', 'speakeasy'], exits: [], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Case Board', type: 'inspect', description: 'Photos, string, and questions without answers.' }], parentDistrictId: 'downtown' },
    { id: 'crime-scene', name: 'Crime Scene', tags: ['outdoor', 'evidence'], description: 'Yellow tape. Chalk outlines. The smell of wet pavement.', gridX: 18, gridY: 10, gridWidth: 7, gridHeight: 5, neighbors: ['office', 'alley'], exits: [], light: 4, noise: 3, hazards: [], interactables: [{ name: 'Evidence Marker', type: 'inspect', description: 'A numbered marker next to a bloodstain.' }], parentDistrictId: 'downtown' },
    { id: 'speakeasy', name: 'Speakeasy', tags: ['interior', 'social'], description: 'Jazz, smoke, and people who know things they should not.', gridX: 8, gridY: 20, gridWidth: 7, gridHeight: 5, neighbors: ['office'], exits: [], light: 3, noise: 6, hazards: [], interactables: [{ name: 'Bar Counter', type: 'talk', description: 'The bartender sees everything and says almost nothing.' }], parentDistrictId: 'downtown' },
    { id: 'alley', name: 'Back Alley', tags: ['outdoor', 'danger'], description: 'Narrow, dark, and full of things best left alone.', gridX: 28, gridY: 14, gridWidth: 5, gridHeight: 6, neighbors: ['crime-scene'], exits: [], light: 2, noise: 1, hazards: ['ambush'], interactables: [{ name: 'Trash Can', type: 'inspect', description: 'Something was discarded here recently.' }], parentDistrictId: 'downtown' },
  ],

  connections: [
    { fromZoneId: 'office', toZoneId: 'crime-scene', bidirectional: true },
    { fromZoneId: 'office', toZoneId: 'speakeasy', bidirectional: true },
    { fromZoneId: 'crime-scene', toZoneId: 'alley', bidirectional: true },
  ],

  districts: [{
    id: 'downtown', name: 'Downtown Precinct',
    zoneIds: ['office', 'crime-scene', 'speakeasy', 'alley'],
    tags: ['urban', 'noir'],
    baseMetrics: { commerce: 50, morale: 35, safety: 40, stability: 45 },
    economyProfile: { supplyCategories: ['information', 'favors'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'office-spawn', zoneId: 'office', gridX: 10, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'witness', name: 'Nervous Witness', zoneId: 'speakeasy', role: 'npc', dialogueId: 'witness-talk', tags: ['witness', 'scared'] },
    { entityId: 'suspect', name: 'Shady Figure', zoneId: 'alley', role: 'npc', tags: ['suspect', 'evasive'] },
  ],

  dialogues: [{
    id: 'witness-talk', speakers: ['witness'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'witness', text: 'I... I already told the police everything.', choices: [
        { id: 'c1', text: 'Tell me again. Slowly.', nextNodeId: 'detail' },
        { id: 'c2', text: 'Relax. I just want to talk.', nextNodeId: 'detail' },
      ]},
      detail: { id: 'detail', speaker: 'witness', text: 'I heard shouting around midnight. Then a car — black sedan — tore out of the alley. That is all I saw.', choices: [
        { id: 'c3', text: 'Did you see the driver?', nextNodeId: 'farewell' },
        { id: 'c4', text: 'Thank you. Stay safe.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'witness', text: 'Please... just find who did this.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Private Eye',
    defaultArchetypeId: 'investigator',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 6 },
    startingInventory: [],
    startingEquipment: {},
    spawnPointId: 'office-spawn',
    tags: ['detective'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'investigator', name: 'Investigator', description: 'Methodical mind, sharp eye for detail.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['analytical'], progressionTreeId: 'sleuth-path', grantedVerbs: ['investigate', 'interrogate'] },
      { id: 'enforcer', name: 'Enforcer', description: 'Solves problems the direct way.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['intimidating'], progressionTreeId: 'sleuth-path', grantedVerbs: ['threaten', 'subdue'] },
    ],
    backgrounds: [
      { id: 'ex-cop', name: 'Ex-Cop', description: 'You left the force, but the force never left you.', statModifiers: { will: 1 }, startingTags: ['law-trained'] },
    ],
    traits: [
      { id: 'keen-observer', name: 'Keen Observer', description: 'You catch what others miss.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'perceptive' }] },
      { id: 'insomniac', name: 'Insomniac', description: 'Sleep is a luxury you cannot afford.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'sleuth-path', name: 'Sleuth Path', currency: 'clues',
    nodes: [
      { id: 'cold-reading', name: 'Cold Reading', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'read-person' } }] },
      { id: 'forensic-eye', name: 'Forensic Eye', cost: 3, requires: ['cold-reading'], effects: [{ type: 'grant-tag', params: { tag: 'forensic-trained' } }] },
    ],
  }],

  itemPlacements: [],
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
