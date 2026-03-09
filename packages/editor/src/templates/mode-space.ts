// mode-space.ts — Space mode starter template

import type { WorldProject } from '@world-forge/schema';

export const spaceStarter: WorldProject = {
  id: 'space-starter',
  name: 'Relay Station',
  description: 'An orbital relay station at the edge of charted space.',
  version: '0.1.0',
  genre: 'sci-fi',
  tones: ['isolated', 'technical'],
  difficulty: 'beginner',
  narratorTone: 'The hum of life support is the only sound in the void.',
  mode: 'space',

  map: { id: 'map-1', name: 'Relay Station Kappa', description: 'A deep-space relay station orbiting a dead star.', gridWidth: 100, gridHeight: 80, tileSize: 64 },

  zones: [
    { id: 'command-deck', name: 'Sector 1', tags: ['station', 'safe'], description: 'The nerve center of the relay station.', gridX: 30, gridY: 30, gridWidth: 10, gridHeight: 8, neighbors: ['cargo-ring', 'docking-arm', 'sensor-array'], exits: [], light: 7, noise: 3, hazards: [], interactables: [{ name: 'Star Chart Terminal', type: 'use', description: 'Holographic navigation display showing nearby sectors.' }], parentDistrictId: 'station-core' },
    { id: 'cargo-ring', name: 'Sector 2', tags: ['station', 'storage'], description: 'A rotating ring of pressurized cargo bays.', gridX: 50, gridY: 25, gridWidth: 8, gridHeight: 8, neighbors: ['command-deck'], exits: [], light: 5, noise: 4, hazards: [], interactables: [{ name: 'Cargo Manifest', type: 'inspect', description: 'Digital inventory of stored goods.' }], parentDistrictId: 'station-core' },
    { id: 'docking-arm', name: 'Sector 3', tags: ['station', 'transit'], description: 'External docking clamps for visiting vessels.', gridX: 10, gridY: 35, gridWidth: 10, gridHeight: 6, neighbors: ['command-deck'], exits: [], light: 6, noise: 5, hazards: ['depressurization-risk'], interactables: [{ name: 'Airlock Controls', type: 'use', description: 'Manual override panel for the docking clamps.' }], parentDistrictId: 'station-core' },
    { id: 'sensor-array', name: 'Sector 4', tags: ['orbit', 'danger'], description: 'An exposed sensor platform beyond the hull.', gridX: 40, gridY: 50, gridWidth: 8, gridHeight: 6, neighbors: ['command-deck'], exits: [], light: 0, noise: 0, hazards: ['vacuum'], interactables: [{ name: 'Long-Range Scanner', type: 'use', description: 'Powerful sensor dish aimed at the void.' }], parentDistrictId: 'station-core' },
  ],

  connections: [
    { fromZoneId: 'command-deck', toZoneId: 'cargo-ring', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'command-deck', toZoneId: 'docking-arm', bidirectional: true, kind: 'docking' },
    { fromZoneId: 'command-deck', toZoneId: 'sensor-array', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'docking-arm', toZoneId: 'sensor-array', bidirectional: false, kind: 'warp' },
  ],

  districts: [{
    id: 'station-core', name: 'Station Kappa Core',
    zoneIds: ['command-deck', 'cargo-ring', 'docking-arm', 'sensor-array'],
    tags: ['orbital', 'corporate'],
    baseMetrics: { commerce: 50, morale: 45, safety: 60, stability: 55 },
    economyProfile: { supplyCategories: ['fuel', 'components', 'rations'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'arrival-dock', zoneId: 'docking-arm', gridX: 14, gridY: 37, isDefault: true }],

  entityPlacements: [
    { entityId: 'station-commander', name: 'Commander Vex', zoneId: 'command-deck', role: 'quest-giver', dialogueId: 'vex-talk', tags: ['authority', 'military'] },
    { entityId: 'rogue-drone', name: 'Rogue Maintenance Drone', zoneId: 'sensor-array', role: 'enemy', tags: ['machine', 'malfunctioning'] },
  ],

  dialogues: [{
    id: 'vex-talk', speakers: ['vex'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'vex', text: 'You arrived just in time. We lost contact with the sensor array — and something out there is jamming our signals.', choices: [
        { id: 'c1', text: 'What kind of jamming?', nextNodeId: 'details' },
        { id: 'c2', text: 'I will check it out.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'vex', text: 'Pattern matches rogue drone activity. They took over the maintenance systems. Be careful near the hull — vacuum is unforgiving.', choices: [
        { id: 'c3', text: 'Understood.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'vex', text: 'Good luck out there, spacer.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Spacer',
    defaultArchetypeId: 'technician',
    baseStats: { vigor: 2, instinct: 3, will: 4 },
    baseResources: { hp: 7, stamina: 8 },
    startingInventory: ['plasma-cutter', 'repair-kit'],
    startingEquipment: { weapon: 'plasma-cutter' },
    spawnPointId: 'arrival-dock',
    tags: ['spacer'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'technician', name: 'Technician', description: 'Keeps systems running with spit and solder.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['engineer'], progressionTreeId: 'station-path', grantedVerbs: ['repair', 'hack'] },
      { id: 'operative', name: 'Operative', description: 'Trained for zero-g combat and infiltration.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['tactical'], progressionTreeId: 'station-path', grantedVerbs: ['strike', 'breach'] },
    ],
    backgrounds: [
      { id: 'belt-miner', name: 'Belt Miner', description: 'You worked the asteroid fields before this.', statModifiers: { vigor: 1 }, startingTags: ['hard-working'] },
    ],
    traits: [
      { id: 'vacuum-trained', name: 'Vacuum Trained', description: 'EVA suits are your second skin.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'eva-certified' }] },
      { id: 'space-sick', name: 'Space Sick', description: 'Zero-g makes your stomach rebel.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'station-path', name: 'Station Path', currency: 'cred',
    nodes: [
      { id: 'system-override', name: 'System Override', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'override' } }] },
      { id: 'drone-command', name: 'Drone Command', cost: 3, requires: ['system-override'], effects: [{ type: 'grant-tag', params: { tag: 'drone-master' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'plasma-cutter', name: 'Plasma Cutter', description: 'A tool that doubles as a weapon in a pinch.', zoneId: 'docking-arm', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { will: 1 } },
    { itemId: 'repair-kit', name: 'Repair Kit', description: 'Standard-issue field repair tools.', zoneId: 'docking-arm', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['engineer'] },
  ],

  encounterAnchors: [
    { id: 'drone-swarm', zoneId: 'sensor-array', encounterType: 'boarding', enemyIds: ['rogue-drone'], probability: 0.6, cooldownTurns: 4, tags: ['space', 'mechanical'] },
  ],

  factionPresences: [
    { factionId: 'station-authority', districtIds: ['station-core'], influence: 70, alertLevel: 55 },
  ],

  pressureHotspots: [
    { id: 'hull-breach-risk', zoneId: 'sensor-array', pressureType: 'hull-breach', baseProbability: 0.4, tags: ['structural'] },
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
