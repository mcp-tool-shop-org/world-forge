// mode-dungeon.ts — Dungeon mode starter template

import type { WorldProject } from '@world-forge/schema';

export const dungeonStarter: WorldProject = {
  id: 'dungeon-starter',
  name: 'Forgotten Vault',
  description: 'A sealed underground vault with traps and hidden passages.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['atmospheric', 'tense'],
  difficulty: 'beginner',
  narratorTone: 'Dust falls from the ceiling with every footstep.',
  mode: 'dungeon',

  map: { id: 'map-1', name: 'The Forgotten Vault', description: 'A buried complex of chambers and corridors.', gridWidth: 30, gridHeight: 25, tileSize: 32 },

  zones: [
    { id: 'entry-hall', name: 'Chamber 1', tags: ['chamber', 'safe'], description: 'A crumbling entry hall with collapsed pillars.', gridX: 4, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['guard-room', 'corridor'], exits: [], light: 4, noise: 1, hazards: [], interactables: [{ name: 'Collapsed Pillar', type: 'inspect', description: 'A toppled stone column, partially blocking the path.' }], parentDistrictId: 'vault-level-1' },
    { id: 'guard-room', name: 'Chamber 2', tags: ['chamber', 'danger'], description: 'An old guard post, bones still in their armor.', gridX: 14, gridY: 6, gridWidth: 5, gridHeight: 5, neighbors: ['entry-hall', 'vault-core'], exits: [], light: 2, noise: 0, hazards: [], interactables: [{ name: 'Rusty Weapon Rack', type: 'inspect', description: 'A few corroded blades remain.' }], parentDistrictId: 'vault-level-1' },
    { id: 'corridor', name: 'Corridor 1', tags: ['corridor'], description: 'A narrow passage with scratches along the walls.', gridX: 14, gridY: 14, gridWidth: 3, gridHeight: 6, neighbors: ['entry-hall', 'vault-core'], exits: [], light: 1, noise: 0, hazards: ['crumbling-floor'], interactables: [], parentDistrictId: 'vault-level-1' },
    { id: 'vault-core', name: 'Chamber 3', tags: ['vault', 'danger'], description: 'The sealed heart of the vault. Something still guards it.', gridX: 22, gridY: 10, gridWidth: 6, gridHeight: 5, neighbors: ['guard-room', 'corridor'], exits: [], light: 0, noise: 2, hazards: ['trap'], interactables: [{ name: 'Sealed Chest', type: 'use', description: 'Heavy iron bindings hold this chest shut.' }], parentDistrictId: 'vault-level-1' },
  ],

  connections: [
    { fromZoneId: 'entry-hall', toZoneId: 'guard-room', bidirectional: true, kind: 'door' },
    { fromZoneId: 'entry-hall', toZoneId: 'corridor', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'guard-room', toZoneId: 'vault-core', bidirectional: true, kind: 'stairs' },
    { fromZoneId: 'corridor', toZoneId: 'vault-core', bidirectional: false, kind: 'secret' },
  ],

  districts: [{
    id: 'vault-level-1', name: 'Vault Level 1',
    zoneIds: ['entry-hall', 'guard-room', 'corridor', 'vault-core'],
    tags: ['underground', 'sealed'],
    baseMetrics: { commerce: 0, morale: 15, safety: 10, stability: 20 },
    economyProfile: { supplyCategories: ['salvage'], scarcityDefaults: {} },
  }],

  landmarks: [],

  spawnPoints: [{ id: 'vault-entrance', zoneId: 'entry-hall', gridX: 5, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'vault-guardian', name: 'Vault Guardian', zoneId: 'vault-core', role: 'enemy', tags: ['construct', 'guardian'] },
    { entityId: 'trapped-scholar', name: 'Trapped Scholar', zoneId: 'guard-room', role: 'npc', dialogueId: 'scholar-talk', tags: ['survivor', 'quest'] },
  ],

  dialogues: [{
    id: 'scholar-talk', speakers: ['scholar'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'scholar', text: 'Thank the gods! I have been trapped here for days. The vault guardian blocks the only way out.', choices: [
        { id: 'c1', text: 'How did you get in?', nextNodeId: 'explain' },
        { id: 'c2', text: 'I will deal with it.', nextNodeId: 'farewell' },
      ]},
      explain: { id: 'explain', speaker: 'scholar', text: 'There is a secret passage from the corridor. The guardian does not watch it. But you will need to be careful of the crumbling floor.', choices: [
        { id: 'c3', text: 'I will find it.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'scholar', text: 'Good luck, delver. I will wait here.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Delver',
    defaultArchetypeId: 'rogue',
    baseStats: { vigor: 3, instinct: 4, will: 2 },
    baseResources: { hp: 8, stamina: 6 },
    startingInventory: ['short-blade', 'lantern-oil'],
    startingEquipment: { weapon: 'short-blade' },
    spawnPointId: 'vault-entrance',
    tags: ['delver'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'rogue', name: 'Rogue', description: 'A nimble explorer of dark places.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['stealth'], progressionTreeId: 'delver-path', grantedVerbs: ['sneak', 'pick-lock'] },
      { id: 'knight', name: 'Knight', description: 'A heavily armored vault breaker.', statPriorities: { vigor: 2, will: 1 }, startingTags: ['martial'], progressionTreeId: 'delver-path', grantedVerbs: ['strike', 'shield-bash'] },
    ],
    backgrounds: [
      { id: 'tomb-raider', name: 'Tomb Raider', description: 'You have delved into ruins before.', statModifiers: { instinct: 1 }, startingTags: ['experienced'] },
    ],
    traits: [
      { id: 'dark-sight', name: 'Dark Sight', description: 'Your eyes adjust quickly to total darkness.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'darkvision' }] },
      { id: 'claustrophobic', name: 'Claustrophobic', description: 'Tight spaces make your hands shake.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'delver-path', name: "Delver's Path", currency: 'xp',
    nodes: [
      { id: 'trap-sense', name: 'Trap Sense', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'trap-aware' } }] },
      { id: 'shadow-step', name: 'Shadow Step', cost: 3, requires: ['trap-sense'], effects: [{ type: 'grant-verb', params: { verb: 'shadow-step' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'short-blade', name: 'Short Blade', description: 'A keen dagger suited for tight corridors.', zoneId: 'entry-hall', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { instinct: 1 } },
    { itemId: 'lantern-oil', name: 'Lantern Oil', description: 'A flask of oil for keeping the dark at bay.', zoneId: 'entry-hall', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['light-source'] },
  ],

  encounterAnchors: [
    { id: 'vault-patrol', zoneId: 'corridor', encounterType: 'patrol', enemyIds: ['vault-guardian'], probability: 0.7, cooldownTurns: 3, tags: ['dungeon', 'patrol'] },
  ],

  factionPresences: [
    { factionId: 'vault-constructs', districtIds: ['vault-level-1'], influence: 80, alertLevel: 60 },
  ],

  pressureHotspots: [
    { id: 'trap-corridor', zoneId: 'corridor', pressureType: 'trap-activation', baseProbability: 0.6, tags: ['trap'] },
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
