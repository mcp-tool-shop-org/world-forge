// chapel-authored.ts — hand-authored version of Chapel Threshold with spatial data

import type { WorldProject } from '../../project.js';

export const chapelProject: WorldProject = {
  id: 'chapel-threshold',
  name: 'Chapel Threshold',
  description: 'A ruined chapel atop an ancient crypt, where the faithful once prayed and the dead now stir.',
  version: '1.0.0',
  genre: 'fantasy',
  tones: ['dark', 'atmospheric'],
  difficulty: 'beginner',
  narratorTone: 'epic chronicle voice, archaic turns of phrase',

  map: {
    id: 'chapel-map',
    name: 'Chapel Threshold',
    description: 'A ruined chapel and its crypt.',
    gridWidth: 40,
    gridHeight: 50,
    tileSize: 32,
  },

  zones: [
    {
      id: 'chapel-entrance',
      name: 'Chapel Entrance',
      tags: ['outdoor', 'safe', 'start'],
      description: 'Cracked stone steps lead to weathered doors.',
      gridX: 10, gridY: 0, gridWidth: 20, gridHeight: 10,
      neighbors: ['chapel-nave'],
      exits: [{ targetZoneId: 'chapel-nave', label: 'Through the doors' }],
      light: 8, noise: 3,
      hazards: [],
      interactables: [{ name: 'worn-inscription', type: 'inspect' }, { name: 'iron-gate', type: 'use' }],
      parentDistrictId: 'chapel-grounds',
    },
    {
      id: 'chapel-nave',
      name: 'Chapel Nave',
      tags: ['indoor', 'sacred'],
      description: 'Pews lie overturned beneath a shattered stained-glass window.',
      gridX: 10, gridY: 10, gridWidth: 20, gridHeight: 10,
      neighbors: ['chapel-entrance', 'chapel-alcove', 'vestry-door'],
      exits: [
        { targetZoneId: 'chapel-entrance', label: 'Back outside' },
        { targetZoneId: 'chapel-alcove', label: 'Side alcove' },
        { targetZoneId: 'vestry-door', label: 'Vestry door' },
      ],
      light: 5, noise: 2,
      hazards: [],
      interactables: [{ name: 'altar', type: 'inspect' }, { name: 'broken-pews', type: 'inspect' }],
      parentDistrictId: 'chapel-grounds',
    },
    {
      id: 'chapel-alcove',
      name: 'Chapel Alcove',
      tags: ['indoor', 'sacred', 'hidden'],
      description: 'A quiet nook with a saint\'s statue and a prayer candle.',
      gridX: 0, gridY: 10, gridWidth: 10, gridHeight: 10,
      neighbors: ['chapel-nave'],
      exits: [{ targetZoneId: 'chapel-nave', label: 'Back to nave' }],
      light: 3, noise: 0,
      hazards: [],
      interactables: [{ name: 'saint-statue', type: 'inspect' }, { name: 'prayer-candle', type: 'use' }],
      parentDistrictId: 'chapel-grounds',
    },
    {
      id: 'vestry-door',
      name: 'Vestry Door',
      tags: ['indoor', 'transition'],
      description: 'A heavy iron door with a rusted lock.',
      gridX: 10, gridY: 20, gridWidth: 20, gridHeight: 5,
      neighbors: ['chapel-nave', 'crypt-chamber'],
      exits: [
        { targetZoneId: 'chapel-nave', label: 'Back to nave' },
        { targetZoneId: 'crypt-chamber', label: 'Descend into the crypt' },
      ],
      light: 2, noise: 1,
      hazards: [],
      interactables: [{ name: 'iron-lock', type: 'use' }],
      parentDistrictId: 'chapel-grounds',
    },
    {
      id: 'crypt-chamber',
      name: 'Crypt Chamber',
      tags: ['underground', 'dangerous', 'dark'],
      description: 'The air is cold and thick with dust. Stone coffins line the walls.',
      gridX: 10, gridY: 25, gridWidth: 20, gridHeight: 15,
      neighbors: ['vestry-door'],
      exits: [{ targetZoneId: 'vestry-door', label: 'Climb back up' }],
      light: 1, noise: 1,
      hazards: ['crumbling-floor', 'toxic-spores'],
      interactables: [{ name: 'stone-coffins', type: 'inspect' }, { name: 'ancient-inscription', type: 'inspect' }],
      parentDistrictId: 'crypt-depths',
    },
  ],

  connections: [
    { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: true },
    { fromZoneId: 'chapel-nave', toZoneId: 'chapel-alcove', bidirectional: true },
    { fromZoneId: 'chapel-nave', toZoneId: 'vestry-door', bidirectional: true },
    { fromZoneId: 'vestry-door', toZoneId: 'crypt-chamber', bidirectional: true },
  ],

  districts: [
    {
      id: 'chapel-grounds',
      name: 'Chapel Grounds',
      zoneIds: ['chapel-entrance', 'chapel-nave', 'chapel-alcove', 'vestry-door'],
      tags: ['sacred', 'ruined'],
      controllingFaction: 'chapel-order',
      baseMetrics: { commerce: 10, morale: 30, safety: 40, stability: 50 },
      economyProfile: { supplyCategories: ['provisions', 'relics'], scarcityDefaults: {} },
    },
    {
      id: 'crypt-depths',
      name: 'Crypt Depths',
      zoneIds: ['crypt-chamber'],
      tags: ['underground', 'haunted'],
      controllingFaction: 'chapel-undead',
      baseMetrics: { commerce: 0, morale: 10, safety: 10, stability: 20 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    },
  ],

  landmarks: [
    {
      id: 'altar-landmark',
      name: 'The Broken Altar',
      zoneId: 'chapel-nave',
      gridX: 20, gridY: 15,
      tags: ['sacred', 'interact'],
      description: 'Once consecrated, now cracked and stained.',
      interactionType: 'inspect',
    },
  ],

  factionPresences: [
    {
      factionId: 'chapel-order',
      districtIds: ['chapel-grounds'],
      influence: 40,
      alertLevel: 10,
    },
    {
      factionId: 'chapel-undead',
      districtIds: ['crypt-depths'],
      influence: 90,
      alertLevel: 0,
    },
  ],

  pressureHotspots: [
    {
      id: 'crypt-pressure',
      zoneId: 'crypt-chamber',
      pressureType: 'undead-incursion',
      baseProbability: 0.4,
      tags: ['undead', 'combat'],
    },
  ],

  entityPlacements: [
    { entityId: 'suspicious-pilgrim', zoneId: 'chapel-entrance', role: 'npc', dialogueId: 'pilgrim-talk' },
    { entityId: 'brother-aldric', zoneId: 'chapel-nave', role: 'companion', factionId: 'chapel-order' },
    { entityId: 'sister-maren', zoneId: 'chapel-alcove', role: 'npc', factionId: 'chapel-order' },
    { entityId: 'ash-ghoul', zoneId: 'crypt-chamber', role: 'boss', factionId: 'chapel-undead' },
  ],

  itemPlacements: [
    { itemId: 'rusted-mace', zoneId: 'chapel-nave', hidden: false },
    { itemId: 'chapel-lantern', zoneId: 'chapel-entrance', hidden: false },
    { itemId: 'bone-talisman', zoneId: 'crypt-chamber', container: 'stone-coffin', hidden: true },
  ],

  encounterAnchors: [
    {
      id: 'crypt-encounter',
      zoneId: 'crypt-chamber',
      encounterType: 'combat',
      enemyIds: ['ash-ghoul'],
      probability: 1.0,
      cooldownTurns: 0,
      tags: ['boss', 'undead'],
    },
  ],

  spawnPoints: [
    { id: 'chapel-spawn', zoneId: 'chapel-entrance', gridX: 15, gridY: 5, isDefault: true },
  ],

  craftingStations: [],
  marketNodes: [],

  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [
    {
      id: 'crypt-fog',
      name: 'Crypt Fog',
      zoneIds: ['crypt-chamber'],
      type: 'fog',
      intensity: 0.7,
      color: '#1a1a2e',
    },
  ],
};
