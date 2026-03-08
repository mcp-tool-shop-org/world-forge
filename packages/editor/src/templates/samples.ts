// samples.ts — sample worlds for learning and reference

import type { WorldProject } from '@world-forge/schema';
import type { SampleWorld } from './registry.js';

const helloWorld: WorldProject = {
  id: 'hello-world',
  name: 'Hello World',
  description: 'The smallest valid world — one zone, one spawn, one district.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['neutral'],
  difficulty: 'beginner',
  narratorTone: '',
  map: { id: 'map-1', name: 'Map', description: '', gridWidth: 40, gridHeight: 30, tileSize: 32 },
  zones: [
    { id: 'start', name: 'Starting Area', tags: ['safe'], description: 'A simple clearing.', gridX: 15, gridY: 12, gridWidth: 10, gridHeight: 6, neighbors: [], exits: [], light: 8, noise: 0, hazards: [], interactables: [], parentDistrictId: 'region-1' },
  ],
  connections: [],
  districts: [{
    id: 'region-1', name: 'Region One',
    zoneIds: ['start'], tags: [],
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  }],
  landmarks: [],
  spawnPoints: [{ id: 'spawn-1', zoneId: 'start', gridX: 18, gridY: 14, isDefault: true }],
  entityPlacements: [],
  dialogues: [],
  progressionTrees: [],
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

const chapelThreshold: WorldProject = {
  id: 'chapel-threshold',
  name: 'Chapel Threshold',
  description: 'A rich reference world with factions, encounters, items, build catalog, progression trees, and branching dialogue.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['atmospheric', 'dark'],
  difficulty: 'intermediate',
  narratorTone: 'Dust motes drift through shafts of pale light. The chapel holds its breath.',

  map: { id: 'map-1', name: 'Chapel Threshold', description: 'A crumbling chapel complex above a haunted crypt.', gridWidth: 60, gridHeight: 40, tileSize: 32 },

  zones: [
    { id: 'chapel-entrance', name: 'Chapel Entrance', tags: ['exterior', 'safe'], description: 'Cracked flagstones lead to iron-bound doors.', gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6, neighbors: ['chapel-nave'], exits: [{ targetZoneId: 'chapel-nave', label: 'Enter Chapel' }], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Stone Plaque', type: 'inspect', description: 'Words worn smooth by centuries of rain.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'chapel-nave', name: 'Chapel Nave', tags: ['interior', 'sacred'], description: 'Rows of pews face a shattered altar. Candlelight flickers.', gridX: 10, gridY: 20, gridWidth: 10, gridHeight: 8, neighbors: ['chapel-entrance', 'chapel-alcove', 'vestry-door'], exits: [], light: 4, noise: 1, hazards: [], interactables: [{ name: 'Altar', type: 'inspect', description: 'The altar stone is cracked but still consecrated.' }, { name: 'Candle Rack', type: 'use', description: 'Light a candle for the departed.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'chapel-alcove', name: 'Chapel Alcove', tags: ['interior', 'hidden'], description: 'A side niche concealing a passage downward.', gridX: 22, gridY: 22, gridWidth: 5, gridHeight: 4, neighbors: ['chapel-nave'], exits: [{ targetZoneId: 'crypt-chamber', label: 'Descend to Crypt', condition: 'has-tag:chapel-key' }], light: 2, noise: 0, hazards: [], interactables: [{ name: 'Hidden Lever', type: 'use', description: 'A lever disguised as a wall sconce.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'vestry-door', name: 'Vestry Door', tags: ['interior', 'locked'], description: 'A heavy wooden door leading to the vestry. Locked from the inside.', gridX: 4, gridY: 22, gridWidth: 4, gridHeight: 4, neighbors: ['chapel-nave'], exits: [], light: 3, noise: 0, hazards: [], interactables: [{ name: 'Lock', type: 'use', description: 'An old but sturdy lock.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'crypt-chamber', name: 'Crypt Chamber', tags: ['underground', 'danger'], description: 'Cold stone. Old bones. Something stirs in the shadows.', gridX: 30, gridY: 25, gridWidth: 10, gridHeight: 8, neighbors: [], exits: [], light: 1, noise: 3, hazards: ['undead', 'darkness'], interactables: [{ name: 'Sarcophagus', type: 'inspect', description: 'The lid is slightly ajar.' }, { name: 'Rune Circle', type: 'use', description: 'Faintly glowing glyphs etched into the floor.' }], parentDistrictId: 'crypt-depths' },
  ],

  connections: [
    { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: true },
    { fromZoneId: 'chapel-nave', toZoneId: 'chapel-alcove', bidirectional: true },
    { fromZoneId: 'chapel-nave', toZoneId: 'vestry-door', bidirectional: true },
    { fromZoneId: 'chapel-alcove', toZoneId: 'crypt-chamber', bidirectional: true, condition: 'has-tag:chapel-key' },
  ],

  districts: [
    { id: 'chapel-grounds', name: 'Chapel Grounds', zoneIds: ['chapel-entrance', 'chapel-nave', 'chapel-alcove', 'vestry-door'], tags: ['sacred', 'ancient'], baseMetrics: { commerce: 10, morale: 40, safety: 60, stability: 50 }, economyProfile: { supplyCategories: ['relics'], scarcityDefaults: {} } },
    { id: 'crypt-depths', name: 'Crypt Depths', zoneIds: ['crypt-chamber'], tags: ['underground', 'cursed'], baseMetrics: { commerce: 0, morale: 10, safety: 15, stability: 20 }, economyProfile: { supplyCategories: [], scarcityDefaults: {} } },
  ],

  landmarks: [],

  factionPresences: [
    { factionId: 'chapel-order', districtIds: ['chapel-grounds'], influence: 0.4, alertLevel: 0.2 },
    { factionId: 'chapel-undead', districtIds: ['crypt-depths'], influence: 0.9, alertLevel: 0.8 },
  ],

  spawnPoints: [{ id: 'chapel-spawn', zoneId: 'chapel-entrance', gridX: 12, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'suspicious-pilgrim', name: 'Suspicious Pilgrim', zoneId: 'chapel-entrance', role: 'npc', dialogueId: 'pilgrim-talk', tags: ['pilgrim', 'suspicious'] },
    { entityId: 'brother-aldric', name: 'Brother Aldric', zoneId: 'chapel-nave', role: 'companion', factionId: 'chapel-order', tags: ['clergy', 'ally'], stats: { vigor: 3, instinct: 2, will: 4 }, resources: { hp: 12, stamina: 6 } },
    { entityId: 'sister-maren', name: 'Sister Maren', zoneId: 'vestry-door', role: 'companion', factionId: 'chapel-order', tags: ['clergy', 'healer'] },
    { entityId: 'ash-ghoul', name: 'Ash Ghoul', zoneId: 'crypt-chamber', role: 'boss', factionId: 'chapel-undead', tags: ['undead', 'boss'], stats: { vigor: 6, instinct: 4, will: 3 }, resources: { hp: 25, stamina: 10 } },
  ],

  dialogues: [{
    id: 'pilgrim-talk', speakers: ['pilgrim'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'pilgrim', text: 'This chapel... it is not what it seems. The brothers hide something beneath the altar.', choices: [
        { id: 'c1', text: 'What do you mean?', nextNodeId: 'reveal' },
        { id: 'c2', text: 'Mind your own business.', nextNodeId: 'dismiss' },
        { id: 'c3', text: 'How do you know this?', nextNodeId: 'source' },
      ]},
      reveal: { id: 'reveal', speaker: 'pilgrim', text: 'I heard chanting at midnight. Strange lights from below. And screaming — cut short.', choices: [
        { id: 'c4', text: 'I will investigate.', nextNodeId: 'farewell' },
        { id: 'c5', text: 'You are imagining things.', nextNodeId: 'farewell' },
      ]},
      source: { id: 'source', speaker: 'pilgrim', text: 'I came here seeking sanctuary. Instead I found locked doors and nervous clergy. Draw your own conclusions.', choices: [
        { id: 'c6', text: 'Thank you for the warning.', nextNodeId: 'farewell' },
      ]},
      dismiss: { id: 'dismiss', speaker: 'pilgrim', text: 'Fine. But do not say I did not warn you.', choices: [] },
      farewell: { id: 'farewell', speaker: 'pilgrim', text: 'Be careful. Not everything holy is safe.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Wanderer',
    defaultArchetypeId: 'wanderer-class',
    defaultBackgroundId: 'outlander',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: ['rusted-mace', 'chapel-lantern'],
    startingEquipment: { weapon: 'rusted-mace' },
    spawnPointId: 'chapel-spawn',
    tags: ['wanderer'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'wanderer-class', name: 'Wanderer', description: 'A drifter with no allegiance.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['traveler'], progressionTreeId: 'tree-wanderer', grantedVerbs: ['explore', 'evade'] },
      { id: 'zealot', name: 'Zealot', description: 'A fanatic driven by conviction.', statPriorities: { will: 2, vigor: 1 }, startingTags: ['faithful'], progressionTreeId: 'tree-zealot', grantedVerbs: ['smite', 'pray'] },
    ],
    backgrounds: [
      { id: 'outlander', name: 'Outlander', description: 'From lands beyond the known.', statModifiers: { instinct: 1 }, startingTags: ['outsider'] },
      { id: 'acolyte', name: 'Acolyte', description: 'Trained in the rites of the chapel.', statModifiers: { will: 1 }, startingTags: ['clergy'], factionModifiers: { 'chapel-order': 10 } },
    ],
    traits: [
      { id: 'iron-stomach', name: 'Iron Stomach', description: 'Nothing makes you flinch.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'resilient' }] },
      { id: 'haunted', name: 'Haunted', description: 'The dead do not leave you alone.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
      { id: 'sharp-tongue', name: 'Sharp Tongue', description: 'Your words cut deeper than blades.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'persuasive' }] },
    ],
    disciplines: [
      { id: 'holy-fire', name: 'Holy Fire', description: 'Channel sacred flame.', grantedVerb: 'ignite', passive: { type: 'grant-tag', tag: 'fire-touched' }, drawback: { type: 'resource-modifier', resource: 'stamina', amount: -2 }, requiredTags: ['faithful'] },
    ],
    crossTitles: [
      { archetypeId: 'zealot', disciplineId: 'holy-fire', title: 'Flame Keeper', tags: ['fire-keeper'] },
    ],
    entanglements: [
      { id: 'zealot-fire', archetypeId: 'zealot', disciplineId: 'holy-fire', description: 'The zealot burns brighter — and burns out faster.', effects: [{ type: 'resource-modifier', resource: 'hp', amount: -2 }] },
    ],
  },

  progressionTrees: [
    {
      id: 'tree-wanderer', name: 'Wanderer Path', currency: 'xp',
      nodes: [
        { id: 'keen-senses', name: 'Keen Senses', cost: 2, effects: [{ type: 'stat-boost', params: { stat: 'instinct', amount: 1 } }] },
        { id: 'light-step', name: 'Light Step', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'sneak' } }] },
        { id: 'pathfinder', name: 'Pathfinder', cost: 3, requires: ['keen-senses', 'light-step'], effects: [{ type: 'grant-tag', params: { tag: 'pathfinder' } }] },
      ],
    },
    {
      id: 'tree-zealot', name: 'Zealot Path', currency: 'faith',
      nodes: [
        { id: 'righteous-fury', name: 'Righteous Fury', cost: 2, effects: [{ type: 'stat-boost', params: { stat: 'vigor', amount: 1 } }] },
        { id: 'divine-ward', name: 'Divine Ward', cost: 3, requires: ['righteous-fury'], effects: [{ type: 'grant-verb', params: { verb: 'ward' } }] },
      ],
    },
  ],

  itemPlacements: [
    { itemId: 'rusted-mace', name: 'Rusted Mace', description: 'Heavy and pitted, but still serviceable.', zoneId: 'chapel-entrance', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'chapel-lantern', name: 'Chapel Lantern', description: 'A dim lantern that never quite goes out.', zoneId: 'chapel-entrance', hidden: false, slot: 'tool', rarity: 'uncommon', grantedTags: ['light-source'] },
    { itemId: 'bone-talisman', name: 'Bone Talisman', description: 'Carved from something that was once alive.', zoneId: 'crypt-chamber', hidden: true, container: 'sarcophagus', slot: 'trinket', rarity: 'rare', grantedTags: ['death-touched'] },
  ],

  encounterAnchors: [
    { id: 'crypt-encounter', zoneId: 'crypt-chamber', encounterType: 'boss', enemyIds: ['ash-ghoul'], probability: 1, cooldownTurns: 0, tags: ['undead', 'boss'] },
  ],

  pressureHotspots: [],
  craftingStations: [],
  marketNodes: [],
  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [{ id: 'crypt-fog', name: 'Crypt Fog', zoneIds: ['crypt-chamber'], type: 'fog', intensity: 0.7, color: '#2a2a3a' }],
};

const tavernCrossroads: WorldProject = {
  id: 'tavern-crossroads',
  name: 'Tavern Crossroads',
  description: 'A roadside tavern where travelers trade stories and trouble finds everyone.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['atmospheric'],
  difficulty: 'beginner',
  narratorTone: 'Firelight dances across weathered faces. Someone is lying.',
  map: { id: 'map-1', name: 'Tavern Crossroads', description: 'A tavern and courtyard at a crossroads.', gridWidth: 40, gridHeight: 30, tileSize: 32 },
  zones: [
    { id: 'tavern-hall', name: 'Tavern Hall', tags: ['interior', 'social'], description: 'Low beams, long tables, and the smell of stew.', gridX: 10, gridY: 10, gridWidth: 10, gridHeight: 8, neighbors: ['courtyard'], exits: [], light: 6, noise: 5, hazards: [], interactables: [{ name: 'Hearth', type: 'inspect', description: 'A crackling fire that never quite warms the room.' }], parentDistrictId: 'crossroads' },
    { id: 'courtyard', name: 'Courtyard', tags: ['exterior', 'open'], description: 'A muddy yard with a well and hitching post.', gridX: 22, gridY: 12, gridWidth: 8, gridHeight: 6, neighbors: ['tavern-hall'], exits: [], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Well', type: 'use', description: 'Draw water — or drop something in.' }], parentDistrictId: 'crossroads' },
  ],
  connections: [
    { fromZoneId: 'tavern-hall', toZoneId: 'courtyard', bidirectional: true },
  ],
  districts: [{
    id: 'crossroads', name: 'The Crossroads',
    zoneIds: ['tavern-hall', 'courtyard'], tags: ['waypoint'],
    baseMetrics: { commerce: 55, morale: 60, safety: 50, stability: 55 },
    economyProfile: { supplyCategories: ['provisions', 'rumors'], scarcityDefaults: {} },
  }],
  landmarks: [],
  spawnPoints: [{ id: 'tavern-spawn', zoneId: 'tavern-hall', gridX: 14, gridY: 14, isDefault: true }],
  entityPlacements: [
    { entityId: 'innkeeper', name: 'Innkeeper Darla', zoneId: 'tavern-hall', role: 'npc', dialogueId: 'darla-talk', tags: ['innkeeper', 'friendly'] },
  ],
  dialogues: [{
    id: 'darla-talk', speakers: ['darla'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'darla', text: 'Welcome, traveler. Sit down and warm yourself. What brings you to the crossroads?', choices: [
        { id: 'c1', text: 'Just passing through.', nextNodeId: 'passing' },
        { id: 'c2', text: 'Looking for work.', nextNodeId: 'work' },
      ]},
      passing: { id: 'passing', speaker: 'darla', text: 'Everyone says that. Most stay longer than they planned.', choices: [] },
      work: { id: 'work', speaker: 'darla', text: 'There is always something needs doing. Speak to the folk at the tables — someone has a task for willing hands.', choices: [] },
    },
  }],
  playerTemplate: {
    name: 'Traveler',
    defaultArchetypeId: 'drifter',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: ['walking-staff'],
    startingEquipment: { weapon: 'walking-staff' },
    spawnPointId: 'tavern-spawn',
    tags: ['traveler'],
    custom: {},
  },
  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'drifter', name: 'Drifter', description: 'A wanderer with no roots.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['wanderer'], progressionTreeId: 'road-path', grantedVerbs: ['explore', 'barter'] },
    ],
    backgrounds: [
      { id: 'vagabond', name: 'Vagabond', description: 'The open road is your only home.', statModifiers: { instinct: 1 }, startingTags: ['homeless'] },
    ],
    traits: [
      { id: 'charming', name: 'Charming', description: 'People warm to you quickly.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'likeable' }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },
  progressionTrees: [{
    id: 'road-path', name: 'Road Path', currency: 'xp',
    nodes: [
      { id: 'street-smarts', name: 'Street Smarts', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'streetwise' } }] },
      { id: 'silver-tongue', name: 'Silver Tongue', cost: 3, requires: ['street-smarts'], effects: [{ type: 'grant-verb', params: { verb: 'persuade' } }] },
    ],
  }],
  itemPlacements: [
    { itemId: 'walking-staff', name: 'Walking Staff', description: 'Sturdy oak, good for walking and cracking heads.', zoneId: 'tavern-hall', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
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

export const SAMPLE_WORLDS: SampleWorld[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Minimal valid project: 1 zone, 1 spawn, 1 district. The smallest exportable world.',
    complexity: 'minimal',
    project: helloWorld,
  },
  {
    id: 'tavern-crossroads',
    name: 'Tavern Crossroads',
    description: 'A mid-sized starter with player template, build catalog, dialogue, and progression tree.',
    complexity: 'intermediate',
    project: tavernCrossroads,
  },
  {
    id: 'chapel-threshold',
    name: 'Chapel Threshold',
    description: 'Rich reference with factions, encounters, items, build catalog, progression trees, and branching dialogue.',
    complexity: 'rich',
    project: chapelThreshold,
  },
];
