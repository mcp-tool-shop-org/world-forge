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
  mode: 'dungeon',
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
  assets: [],
  assetPacks: [],
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
  mode: 'dungeon',

  map: { id: 'map-1', name: 'Chapel Threshold', description: 'A crumbling chapel complex above a haunted crypt.', gridWidth: 60, gridHeight: 40, tileSize: 32 },

  zones: [
    { id: 'chapel-entrance', name: 'Chapel Entrance', tags: ['exterior', 'safe'], description: 'Cracked flagstones lead to iron-bound doors.', gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6, neighbors: ['chapel-nave'], exits: [{ targetZoneId: 'chapel-nave', label: 'Enter Chapel' }], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Stone Plaque', type: 'inspect', description: 'Words worn smooth by centuries of rain.' }], parentDistrictId: 'chapel-grounds', backgroundId: 'chapel-entrance-bg' },
    { id: 'chapel-nave', name: 'Chapel Nave', tags: ['interior', 'sacred'], description: 'Rows of pews face a shattered altar. Candlelight flickers.', gridX: 10, gridY: 20, gridWidth: 10, gridHeight: 8, neighbors: ['chapel-entrance', 'chapel-alcove', 'vestry-door'], exits: [], light: 4, noise: 1, hazards: [], interactables: [{ name: 'Altar', type: 'inspect', description: 'The altar stone is cracked but still consecrated.' }, { name: 'Candle Rack', type: 'use', description: 'Light a candle for the departed.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'chapel-alcove', name: 'Chapel Alcove', tags: ['interior', 'hidden'], description: 'A side niche concealing a passage downward.', gridX: 22, gridY: 22, gridWidth: 5, gridHeight: 4, neighbors: ['chapel-nave'], exits: [{ targetZoneId: 'crypt-chamber', label: 'Descend to Crypt', condition: 'has-tag:chapel-key' }], light: 2, noise: 0, hazards: [], interactables: [{ name: 'Hidden Lever', type: 'use', description: 'A lever disguised as a wall sconce.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'vestry-door', name: 'Vestry Door', tags: ['interior', 'locked'], description: 'A heavy wooden door leading to the vestry. Locked from the inside.', gridX: 4, gridY: 22, gridWidth: 4, gridHeight: 4, neighbors: ['chapel-nave'], exits: [], light: 3, noise: 0, hazards: [], interactables: [{ name: 'Lock', type: 'use', description: 'An old but sturdy lock.' }], parentDistrictId: 'chapel-grounds' },
    { id: 'crypt-chamber', name: 'Crypt Chamber', tags: ['underground', 'danger'], description: 'Cold stone. Old bones. Something stirs in the shadows.', gridX: 30, gridY: 25, gridWidth: 10, gridHeight: 8, neighbors: [], exits: [], light: 1, noise: 3, hazards: ['undead', 'darkness'], interactables: [{ name: 'Sarcophagus', type: 'inspect', description: 'The lid is slightly ajar.' }, { name: 'Rune Circle', type: 'use', description: 'Faintly glowing glyphs etched into the floor.' }], parentDistrictId: 'crypt-depths', backgroundId: 'crypt-bg' },
  ],

  connections: [
    { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: true, kind: 'door' },
    { fromZoneId: 'chapel-nave', toZoneId: 'chapel-alcove', bidirectional: true },
    { fromZoneId: 'chapel-nave', toZoneId: 'vestry-door', bidirectional: true, kind: 'door' },
    { fromZoneId: 'chapel-alcove', toZoneId: 'crypt-chamber', bidirectional: true, kind: 'secret', condition: 'has-tag:chapel-key' },
  ],

  districts: [
    { id: 'chapel-grounds', name: 'Chapel Grounds', zoneIds: ['chapel-entrance', 'chapel-nave', 'chapel-alcove', 'vestry-door'], tags: ['sacred', 'ancient'], baseMetrics: { commerce: 10, morale: 40, safety: 60, stability: 50 }, economyProfile: { supplyCategories: ['relics'], scarcityDefaults: {} } },
    { id: 'crypt-depths', name: 'Crypt Depths', zoneIds: ['crypt-chamber'], tags: ['underground', 'cursed'], controllingFaction: 'chapel-undead', baseMetrics: { commerce: 0, morale: 10, safety: 15, stability: 20 }, economyProfile: { supplyCategories: [], scarcityDefaults: {} } },
  ],

  landmarks: [
    { id: 'altar-of-passage', name: 'Altar of Passage', zoneId: 'chapel-entrance', gridX: 14, gridY: 13, tags: ['sacred', 'ancient'], description: 'A weathered stone altar marking the threshold between the living world and the crypt below.', interactionType: 'inspect', iconId: 'altar-icon' },
  ],

  factionPresences: [
    { factionId: 'chapel-order', districtIds: ['chapel-grounds'], influence: 0.4, alertLevel: 0.2 },
    { factionId: 'chapel-undead', districtIds: ['crypt-depths'], influence: 0.9, alertLevel: 0.8 },
  ],

  spawnPoints: [{ id: 'chapel-spawn', zoneId: 'chapel-entrance', gridX: 12, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'suspicious-pilgrim', name: 'Suspicious Pilgrim', zoneId: 'chapel-entrance', role: 'npc', dialogueId: 'pilgrim-talk', tags: ['pilgrim', 'suspicious'], portraitId: 'pilgrim-portrait' },
    { entityId: 'brother-aldric', name: 'Brother Aldric', zoneId: 'chapel-nave', role: 'companion', factionId: 'chapel-order', tags: ['clergy', 'ally'], stats: { vigor: 3, instinct: 2, will: 4 }, resources: { hp: 12, stamina: 6 }, portraitId: 'aldric-portrait' },
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
    { itemId: 'bone-talisman', name: 'Bone Talisman', description: 'Carved from something that was once alive.', zoneId: 'crypt-chamber', hidden: true, container: 'sarcophagus', slot: 'trinket', rarity: 'rare', grantedTags: ['death-touched'], iconId: 'bone-talisman-icon' },
  ],

  encounterAnchors: [
    { id: 'crypt-encounter', zoneId: 'crypt-chamber', encounterType: 'boss', enemyIds: ['ash-ghoul'], probability: 1, cooldownTurns: 0, tags: ['undead', 'boss'] },
  ],

  pressureHotspots: [
    { id: 'crypt-pressure', zoneId: 'crypt-chamber', pressureType: 'undead-surge', baseProbability: 0.6, tags: ['undead'] },
  ],
  craftingStations: [],
  marketNodes: [],
  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [{ id: 'crypt-fog', name: 'Crypt Fog', zoneIds: ['crypt-chamber'], type: 'fog', intensity: 0.7, color: '#2a2a3a' }],
  assets: [
    { id: 'chapel-entrance-bg', kind: 'background', label: 'Chapel Entrance', path: 'assets/backgrounds/chapel-entrance.png', tags: ['exterior', 'chapel'], packId: 'chapel-base-pack' },
    { id: 'crypt-bg', kind: 'background', label: 'Crypt Chamber', path: 'assets/backgrounds/crypt-chamber.png', tags: ['underground', 'dark'], packId: 'chapel-base-pack' },
    { id: 'pilgrim-portrait', kind: 'portrait', label: 'Suspicious Pilgrim', path: 'assets/portraits/pilgrim.png', tags: ['npc', 'pilgrim'], packId: 'chapel-base-pack' },
    { id: 'aldric-portrait', kind: 'portrait', label: 'Brother Aldric', path: 'assets/portraits/aldric.png', tags: ['npc', 'clergy'], packId: 'chapel-base-pack' },
    { id: 'bone-talisman-icon', kind: 'icon', label: 'Bone Talisman', path: 'assets/icons/bone-talisman.png', tags: ['item', 'rare'], packId: 'chapel-base-pack' },
    { id: 'altar-icon', kind: 'icon', label: 'Altar of Passage', path: 'assets/icons/altar-of-passage.png', tags: ['landmark', 'sacred'], packId: 'chapel-base-pack' },
  ],
  assetPacks: [{
    id: 'chapel-base-pack',
    label: 'Chapel Threshold Assets',
    version: '1.0.0',
    description: 'Base visual assets for the Chapel Threshold sample.',
    tags: ['fantasy', 'dark', 'chapel'],
    theme: 'dark-fantasy',
    source: 'hand-drawn',
    license: 'CC-BY-4.0',
    author: 'mcp-tool-shop',
  }],
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
  mode: 'district',
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
  assets: [],
  assetPacks: [],
};

// ── Ocean sample: Smuggler's Cove ─────────────────────────────

const oceanHarbor: WorldProject = {
  id: 'ocean-harbor',
  name: 'Smuggler\'s Cove',
  description: 'A hidden cove where smugglers trade contraband under the watch of a corrupt harbor master.',
  version: '0.1.0',
  genre: 'pirate',
  tones: ['adventurous', 'lawless'],
  difficulty: 'beginner',
  narratorTone: 'Waves lap against barnacled hulls. The cove smells of salt and secrecy.',
  mode: 'ocean',

  map: { id: 'map-1', name: 'Smuggler\'s Cove', description: 'A concealed cove ringed by cliffs and reef.', gridWidth: 60, gridHeight: 50, tileSize: 48 },

  zones: [
    { id: 'harbor', name: 'Hidden Harbor', tags: ['port', 'safe'], description: 'A narrow inlet where small ships moor beneath overhanging cliffs.', gridX: 5, gridY: 20, gridWidth: 12, gridHeight: 10, neighbors: ['smuggler-channel', 'reef-passage'], exits: [], light: 6, noise: 4, hazards: [], interactables: [{ name: 'Dock Manifest', type: 'inspect', description: 'A ledger listing cargoes in coded shorthand.' }], parentDistrictId: 'cove-waters' },
    { id: 'smuggler-channel', name: 'Smuggler Channel', tags: ['trade-lane', 'shallow'], description: 'A winding channel between the cliffs, barely wide enough for a sloop.', gridX: 22, gridY: 16, gridWidth: 14, gridHeight: 8, neighbors: ['harbor', 'open-sea'], exits: [], light: 7, noise: 2, hazards: ['shallow-draft'], interactables: [{ name: 'Signal Lantern', type: 'use', description: 'A hooded lantern used to guide ships through the narrows.' }], parentDistrictId: 'cove-waters' },
    { id: 'reef-passage', name: 'Reef Passage', tags: ['reef', 'danger'], description: 'Jagged coral formations hiding a shortcut to open water.', gridX: 10, gridY: 36, gridWidth: 10, gridHeight: 8, neighbors: ['harbor'], exits: [], light: 8, noise: 1, hazards: ['coral-scrape'], interactables: [{ name: 'Sunken Chest', type: 'inspect', description: 'A waterlogged chest wedged between coral heads.' }], parentDistrictId: 'cove-waters' },
    { id: 'open-sea', name: 'Open Sea', tags: ['deep', 'dangerous'], description: 'The open ocean beyond the cove, where patrol ships prowl.', gridX: 42, gridY: 18, gridWidth: 12, gridHeight: 12, neighbors: ['smuggler-channel'], exits: [], light: 9, noise: 1, hazards: ['storm-risk'], interactables: [{ name: 'Patrol Flags', type: 'inspect', description: 'Distant sails bearing the king\'s colors.' }], parentDistrictId: 'cove-waters' },
  ],

  connections: [
    { fromZoneId: 'harbor', toZoneId: 'smuggler-channel', bidirectional: true, kind: 'channel' },
    { fromZoneId: 'smuggler-channel', toZoneId: 'open-sea', bidirectional: true, kind: 'route' },
    { fromZoneId: 'harbor', toZoneId: 'reef-passage', bidirectional: true, kind: 'hazard' },
    { fromZoneId: 'reef-passage', toZoneId: 'open-sea', bidirectional: false, kind: 'route' },
  ],

  districts: [{
    id: 'cove-waters', name: 'Smuggler\'s Cove',
    zoneIds: ['harbor', 'smuggler-channel', 'reef-passage', 'open-sea'],
    tags: ['maritime', 'criminal'],
    baseMetrics: { commerce: 70, morale: 50, safety: 25, stability: 30 },
    economyProfile: { supplyCategories: ['contraband', 'rum', 'sailcloth'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'ocean-harbor-spawn', zoneId: 'harbor', gridX: 8, gridY: 24, isDefault: true }],

  entityPlacements: [
    { entityId: 'fence-marlo', name: 'Fence Marlo', zoneId: 'harbor', role: 'quest-giver', dialogueId: 'marlo-talk', tags: ['smuggler', 'fence'] },
    { entityId: 'patrol-cutter', name: 'Patrol Cutter', zoneId: 'open-sea', role: 'enemy', tags: ['navy', 'hostile'] },
  ],

  dialogues: [{
    id: 'marlo-talk', speakers: ['marlo'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'marlo', text: 'Keep your voice down. The patrol is circling closer every day. I need cargo moved before dawn.', choices: [
        { id: 'c1', text: 'What kind of cargo?', nextNodeId: 'details' },
        { id: 'c2', text: 'Not interested.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'marlo', text: 'Spices, mostly. And a few things the crown would rather not see traded. The channel is your best bet — reef passage is faster but riskier.', choices: [
        { id: 'c3', text: 'I will take the channel.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'marlo', text: 'Fair tides, captain.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Smuggler',
    defaultArchetypeId: 'runner',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 7 },
    startingInventory: ['boarding-axe', 'compass'],
    startingEquipment: { weapon: 'boarding-axe' },
    spawnPointId: 'ocean-harbor-spawn',
    tags: ['sailor'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'runner', name: 'Runner', description: 'Fast hands and a faster ship.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['smuggler'], progressionTreeId: 'cove-path', grantedVerbs: ['navigate', 'evade'] },
      { id: 'corsair', name: 'Corsair', description: 'Takes what the sea offers, by force.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['pirate'], progressionTreeId: 'cove-path', grantedVerbs: ['board', 'strike'] },
    ],
    backgrounds: [
      { id: 'fisherman', name: 'Fisherman', description: 'You know these waters like your own hands.', statModifiers: { instinct: 1 }, startingTags: ['local'] },
    ],
    traits: [
      { id: 'sea-legs', name: 'Sea Legs', description: 'Never lose your footing on a rolling deck.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'steady' }] },
      { id: 'wanted', name: 'Wanted', description: 'The navy has a bounty on your head.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'cove-path', name: 'Cove Path', currency: 'fame',
    nodes: [
      { id: 'smuggler-sense', name: 'Smuggler Sense', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'contraband-eye' } }] },
      { id: 'blockade-runner', name: 'Blockade Runner', cost: 3, requires: ['smuggler-sense'], effects: [{ type: 'grant-verb', params: { verb: 'evade-patrol' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'boarding-axe', name: 'Boarding Axe', description: 'Short-hafted axe for deck combat.', zoneId: 'harbor', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'compass', name: 'Smuggler\'s Compass', description: 'A compass with hidden compartments for small valuables.', zoneId: 'harbor', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['navigator'] },
  ],

  encounterAnchors: [
    { id: 'patrol-intercept', zoneId: 'open-sea', encounterType: 'pirate', enemyIds: ['patrol-cutter'], probability: 0.6, cooldownTurns: 3, tags: ['maritime', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'smuggler-ring', districtIds: ['cove-waters'], influence: 75, alertLevel: 45 },
  ],

  pressureHotspots: [
    { id: 'navy-sweep', zoneId: 'smuggler-channel', pressureType: 'pirate-raid', baseProbability: 0.5, tags: ['maritime'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── Space sample: Mining Outpost ──────────────────────────────

const spaceStation: WorldProject = {
  id: 'space-station',
  name: 'Mining Outpost',
  description: 'An asteroid mining platform where corporate greed meets crew desperation.',
  version: '0.1.0',
  genre: 'sci-fi',
  tones: ['industrial', 'tense'],
  difficulty: 'beginner',
  narratorTone: 'The drill rumbles through the hull. Dust filters glow red with overuse.',
  mode: 'space',

  map: { id: 'map-1', name: 'Outpost Theta-7', description: 'A mining outpost bolted to a nickel-iron asteroid.', gridWidth: 100, gridHeight: 80, tileSize: 64 },

  zones: [
    { id: 'bridge', name: 'Operations Hub', tags: ['station', 'command'], description: 'The cramped nerve center tracking drill status and crew vitals.', gridX: 30, gridY: 30, gridWidth: 10, gridHeight: 8, neighbors: ['cargo-bay', 'drill-shaft'], exits: [], light: 7, noise: 4, hazards: [], interactables: [{ name: 'Status Board', type: 'inspect', description: 'Amber warnings flicker across every readout.' }], parentDistrictId: 'outpost-core' },
    { id: 'cargo-bay', name: 'Cargo Bay', tags: ['station', 'storage'], description: 'Ore crates stacked floor to ceiling, waiting for the next freighter.', gridX: 50, gridY: 25, gridWidth: 10, gridHeight: 8, neighbors: ['bridge', 'eva-platform'], exits: [], light: 5, noise: 3, hazards: [], interactables: [{ name: 'Ore Scanner', type: 'use', description: 'Handheld device for grading raw ore quality.' }], parentDistrictId: 'outpost-core' },
    { id: 'drill-shaft', name: 'Drill Shaft', tags: ['industrial', 'danger'], description: 'The main bore tunnel, vibrating with the deep-rock drill.', gridX: 20, gridY: 50, gridWidth: 12, gridHeight: 10, neighbors: ['bridge'], exits: [], light: 2, noise: 8, hazards: ['cave-in'], interactables: [{ name: 'Emergency Shutoff', type: 'use', description: 'Big red handle behind cracked safety glass.' }], parentDistrictId: 'outpost-core' },
    { id: 'eva-platform', name: 'EVA Platform', tags: ['exterior', 'danger'], description: 'An exposed platform for spacewalks and external repairs.', gridX: 60, gridY: 50, gridWidth: 8, gridHeight: 6, neighbors: ['cargo-bay'], exits: [], light: 0, noise: 0, hazards: ['vacuum'], interactables: [{ name: 'Tether Point', type: 'inspect', description: 'Magnetic clamps for EVA safety lines.' }], parentDistrictId: 'outpost-core' },
  ],

  connections: [
    { fromZoneId: 'bridge', toZoneId: 'cargo-bay', bidirectional: true, kind: 'docking' },
    { fromZoneId: 'bridge', toZoneId: 'drill-shaft', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'cargo-bay', toZoneId: 'eva-platform', bidirectional: true, kind: 'docking' },
  ],

  districts: [{
    id: 'outpost-core', name: 'Outpost Theta-7',
    zoneIds: ['bridge', 'cargo-bay', 'drill-shaft', 'eva-platform'],
    tags: ['orbital', 'industrial'],
    baseMetrics: { commerce: 40, morale: 30, safety: 45, stability: 35 },
    economyProfile: { supplyCategories: ['ore', 'coolant', 'rations'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'space-station-spawn', zoneId: 'bridge', gridX: 34, gridY: 33, isDefault: true }],

  entityPlacements: [
    { entityId: 'foreman-jin', name: 'Foreman Jin', zoneId: 'bridge', role: 'quest-giver', dialogueId: 'jin-talk', tags: ['crew', 'authority'] },
    { entityId: 'haywire-drill', name: 'Haywire Drill Bot', zoneId: 'drill-shaft', role: 'enemy', tags: ['machine', 'malfunctioning'] },
  ],

  dialogues: [{
    id: 'jin-talk', speakers: ['jin'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'jin', text: 'The drill bot in shaft three went haywire. Corporate wants output, not excuses. Get down there and sort it.', choices: [
        { id: 'c1', text: 'What happened to it?', nextNodeId: 'details' },
        { id: 'c2', text: 'On my way.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'jin', text: 'Firmware glitch, or so they say. Thing is swinging its cutter arm at anything that moves. Take the emergency shutoff if you can reach it.', choices: [
        { id: 'c3', text: 'Understood.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'jin', text: 'Watch your head down there. Literally.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Miner',
    defaultArchetypeId: 'roughneck',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 9, stamina: 7 },
    startingInventory: ['rock-drill', 'ore-scanner'],
    startingEquipment: { weapon: 'rock-drill' },
    spawnPointId: 'space-station-spawn',
    tags: ['crew'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'roughneck', name: 'Roughneck', description: 'Hard labor and harder fists.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['miner'], progressionTreeId: 'outpost-path', grantedVerbs: ['mine', 'repair'] },
      { id: 'surveyor', name: 'Surveyor', description: 'Finds the veins worth drilling.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['scanner'], progressionTreeId: 'outpost-path', grantedVerbs: ['scan', 'analyze'] },
    ],
    backgrounds: [
      { id: 'belt-rat', name: 'Belt Rat', description: 'Born on a station, never touched dirt.', statModifiers: { instinct: 1 }, startingTags: ['spacer'] },
    ],
    traits: [
      { id: 'zero-g-native', name: 'Zero-G Native', description: 'Weightlessness is your natural state.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'eva-certified' }] },
      { id: 'dust-lung', name: 'Dust Lung', description: 'Years of mining have scarred your lungs.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'outpost-path', name: 'Outpost Path', currency: 'cred',
    nodes: [
      { id: 'hard-hat', name: 'Hard Hat', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'cave-in-resistant' } }] },
      { id: 'drill-mastery', name: 'Drill Mastery', cost: 3, requires: ['hard-hat'], effects: [{ type: 'grant-verb', params: { verb: 'precision-drill' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'rock-drill', name: 'Rock Drill', description: 'A handheld pneumatic drill. Also hurts people.', zoneId: 'bridge', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'ore-scanner', name: 'Ore Scanner', description: 'Detects mineral deposits through rock walls.', zoneId: 'bridge', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['prospector'] },
  ],

  encounterAnchors: [
    { id: 'drill-malfunction', zoneId: 'drill-shaft', encounterType: 'boarding', enemyIds: ['haywire-drill'], probability: 0.7, cooldownTurns: 4, tags: ['mechanical', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'mining-corp', districtIds: ['outpost-core'], influence: 80, alertLevel: 30 },
  ],

  pressureHotspots: [
    { id: 'shaft-collapse', zoneId: 'drill-shaft', pressureType: 'hull-breach', baseProbability: 0.5, tags: ['structural'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── Wilderness sample: Thornwood Path ─────────────────────────

const wildernessTrail: WorldProject = {
  id: 'wilderness-trail',
  name: 'Thornwood Path',
  description: 'A haunted forest trail where old magic lingers and predators stalk the unwary.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['eerie', 'primal'],
  difficulty: 'beginner',
  narratorTone: 'Thorns snag your cloak. The canopy blocks the sky like a closing fist.',
  mode: 'wilderness',

  map: { id: 'map-1', name: 'Thornwood Path', description: 'A dark forest trail with ancient ruins.', gridWidth: 60, gridHeight: 50, tileSize: 48 },

  zones: [
    { id: 'camp', name: 'Ranger Camp', tags: ['camp', 'safe'], description: 'A small clearing where rangers maintain a watch fire.', gridX: 5, gridY: 20, gridWidth: 10, gridHeight: 8, neighbors: ['deep-wood', 'thorn-hollow'], exits: [], light: 6, noise: 2, hazards: [], interactables: [{ name: 'Watch Fire', type: 'use', description: 'A carefully banked fire that keeps the darkness at bay.' }], parentDistrictId: 'thornwood' },
    { id: 'deep-wood', name: 'Deep Wood', tags: ['forest', 'danger'], description: 'Ancient trees grow so close together that you must turn sideways to pass.', gridX: 22, gridY: 14, gridWidth: 12, gridHeight: 8, neighbors: ['camp', 'ruin-glade'], exits: [], light: 2, noise: 1, hazards: ['wildlife'], interactables: [{ name: 'Claw Marks', type: 'inspect', description: 'Deep gouges in the bark, far too high for any wolf.' }], parentDistrictId: 'thornwood' },
    { id: 'thorn-hollow', name: 'Thorn Hollow', tags: ['clearing', 'eerie'], description: 'A sunken hollow choked with thorny brambles and strange mushrooms.', gridX: 10, gridY: 36, gridWidth: 10, gridHeight: 8, neighbors: ['camp'], exits: [], light: 4, noise: 0, hazards: ['poison'], interactables: [{ name: 'Glowing Mushrooms', type: 'inspect', description: 'Pale fungi that pulse with a faint inner light.' }], parentDistrictId: 'thornwood' },
    { id: 'ruin-glade', name: 'Ruin Glade', tags: ['ruins', 'danger'], description: 'Crumbling stone pillars overgrown with vines — remains of something older than the forest.', gridX: 40, gridY: 20, gridWidth: 10, gridHeight: 10, neighbors: ['deep-wood'], exits: [], light: 5, noise: 1, hazards: ['unstable-ground'], interactables: [{ name: 'Rune Stone', type: 'inspect', description: 'Weathered glyphs that still hum when touched.' }], parentDistrictId: 'thornwood' },
  ],

  connections: [
    { fromZoneId: 'camp', toZoneId: 'deep-wood', bidirectional: true, kind: 'trail' },
    { fromZoneId: 'camp', toZoneId: 'thorn-hollow', bidirectional: true, kind: 'trail' },
    { fromZoneId: 'deep-wood', toZoneId: 'ruin-glade', bidirectional: true, kind: 'hazard' },
    { fromZoneId: 'thorn-hollow', toZoneId: 'ruin-glade', bidirectional: false, kind: 'passage' },
  ],

  districts: [{
    id: 'thornwood', name: 'Thornwood',
    zoneIds: ['camp', 'deep-wood', 'thorn-hollow', 'ruin-glade'],
    tags: ['wilderness', 'haunted'],
    baseMetrics: { commerce: 5, morale: 30, safety: 20, stability: 25 },
    economyProfile: { supplyCategories: ['herbs', 'pelts', 'firewood'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'wilderness-trail-spawn', zoneId: 'camp', gridX: 8, gridY: 23, isDefault: true }],

  entityPlacements: [
    { entityId: 'warden-tess', name: 'Warden Tess', zoneId: 'camp', role: 'quest-giver', dialogueId: 'tess-talk', tags: ['ranger', 'guide'] },
    { entityId: 'thornback-bear', name: 'Thornback Bear', zoneId: 'ruin-glade', role: 'enemy', tags: ['beast', 'territorial'] },
  ],

  dialogues: [{
    id: 'tess-talk', speakers: ['tess'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'tess', text: 'Something in the deep wood is driving the animals out. The thornback bear has been seen near the ruins — far from its usual range.', choices: [
        { id: 'c1', text: 'What could be causing it?', nextNodeId: 'details' },
        { id: 'c2', text: 'I will check the ruins.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'tess', text: 'Could be the old magic stirring again. The rune stones in the glade have been glowing at night. Be careful — the hollow is full of poisonous growth.', choices: [
        { id: 'c3', text: 'I will stay on the trails.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'tess', text: 'Keep your blade close and your fire closer.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Woodwalker',
    defaultArchetypeId: 'scout',
    baseStats: { vigor: 3, instinct: 4, will: 2 },
    baseResources: { hp: 9, stamina: 7 },
    startingInventory: ['hatchet', 'herb-bundle'],
    startingEquipment: { weapon: 'hatchet' },
    spawnPointId: 'wilderness-trail-spawn',
    tags: ['ranger'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'scout', name: 'Scout', description: 'Moves unseen through dense terrain.', statPriorities: { instinct: 2, vigor: 1 }, startingTags: ['stealthy'], progressionTreeId: 'wood-path', grantedVerbs: ['track', 'sneak'] },
      { id: 'herbalist', name: 'Herbalist', description: 'Knows every plant that heals or kills.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['healer'], progressionTreeId: 'wood-path', grantedVerbs: ['forage', 'brew'] },
    ],
    backgrounds: [
      { id: 'forester', name: 'Forester', description: 'You grew up among these trees.', statModifiers: { instinct: 1 }, startingTags: ['local'] },
    ],
    traits: [
      { id: 'beast-sense', name: 'Beast Sense', description: 'You smell predators before they smell you.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'alert' }] },
      { id: 'thorn-shy', name: 'Thorn-Shy', description: 'Brambles and thorns slow you to a crawl.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'wood-path', name: 'Wood Path', currency: 'xp',
    nodes: [
      { id: 'forest-eye', name: 'Forest Eye', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'trailblazer' } }] },
      { id: 'beast-caller', name: 'Beast Caller', cost: 3, requires: ['forest-eye'], effects: [{ type: 'grant-verb', params: { verb: 'calm-beast' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'hatchet', name: 'Ranger Hatchet', description: 'A short axe for chopping wood and fending off wildlife.', zoneId: 'camp', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'herb-bundle', name: 'Herb Bundle', description: 'A pouch of medicinal leaves and bark.', zoneId: 'camp', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['herbalist'] },
  ],

  encounterAnchors: [
    { id: 'bear-territory', zoneId: 'ruin-glade', encounterType: 'beast', enemyIds: ['thornback-bear'], probability: 0.7, cooldownTurns: 3, tags: ['wildlife', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'forest-wardens', districtIds: ['thornwood'], influence: 45, alertLevel: 55 },
  ],

  pressureHotspots: [
    { id: 'predator-surge', zoneId: 'deep-wood', pressureType: 'predator-attack', baseProbability: 0.6, tags: ['wildlife'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── District sample: Dockside Market ──────────────────────────

const cityMarket: WorldProject = {
  id: 'city-market',
  name: 'Dockside Market',
  description: 'A bustling waterfront market where merchants, thieves, and city watch clash daily.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['lively', 'gritty'],
  difficulty: 'beginner',
  narratorTone: 'Hawkers shout over each other. Somewhere in the crowd, a purse goes missing.',
  mode: 'district',

  map: { id: 'map-1', name: 'Dockside Market', description: 'A waterfront commercial district.', gridWidth: 50, gridHeight: 40, tileSize: 32 },

  zones: [
    { id: 'market-square', name: 'Market Square', tags: ['trade', 'bustling'], description: 'Stalls and carts packed tight, selling everything from fish to forgeries.', gridX: 10, gridY: 10, gridWidth: 12, gridHeight: 8, neighbors: ['wharf', 'slums'], exits: [], light: 8, noise: 7, hazards: [], interactables: [{ name: 'Notice Board', type: 'inspect', description: 'Job postings, wanted posters, and a few love letters.' }], parentDistrictId: 'dockside' },
    { id: 'wharf', name: 'Wharf', tags: ['docks', 'transit'], description: 'Wooden piers where cargo ships unload under the gull-filled sky.', gridX: 28, gridY: 8, gridWidth: 10, gridHeight: 6, neighbors: ['market-square'], exits: [], light: 9, noise: 5, hazards: [], interactables: [{ name: 'Cargo Crane', type: 'inspect', description: 'A creaking wooden crane for hoisting barrels from ship holds.' }], parentDistrictId: 'dockside' },
    { id: 'slums', name: 'Back Alleys', tags: ['poor', 'dangerous'], description: 'Narrow lanes behind the market where the desperate scrape by.', gridX: 12, gridY: 24, gridWidth: 10, gridHeight: 8, neighbors: ['market-square'], exits: [], light: 3, noise: 2, hazards: ['pickpockets'], interactables: [{ name: 'Graffiti Wall', type: 'inspect', description: 'Gang marks and coded messages cover the crumbling brick.' }], parentDistrictId: 'dockside' },
  ],

  connections: [
    { fromZoneId: 'market-square', toZoneId: 'wharf', bidirectional: true, kind: 'road' },
    { fromZoneId: 'market-square', toZoneId: 'slums', bidirectional: true, kind: 'road' },
    { fromZoneId: 'wharf', toZoneId: 'slums', bidirectional: false, kind: 'passage' },
  ],

  districts: [{
    id: 'dockside', name: 'Dockside District',
    zoneIds: ['market-square', 'wharf', 'slums'],
    tags: ['urban', 'commercial'],
    baseMetrics: { commerce: 75, morale: 55, safety: 35, stability: 45 },
    economyProfile: { supplyCategories: ['fish', 'textiles', 'tools'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'city-market-spawn', zoneId: 'market-square', gridX: 14, gridY: 14, isDefault: true }],

  entityPlacements: [
    { entityId: 'merchant-hale', name: 'Merchant Hale', zoneId: 'market-square', role: 'quest-giver', dialogueId: 'hale-talk', tags: ['merchant', 'worried'] },
    { entityId: 'gang-lookout', name: 'Gang Lookout', zoneId: 'slums', role: 'enemy', tags: ['criminal', 'hostile'] },
  ],

  dialogues: [{
    id: 'hale-talk', speakers: ['hale'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'hale', text: 'Third shipment stolen this week. The gangs in the back alleys are getting bold.', choices: [
        { id: 'c1', text: 'What are they taking?', nextNodeId: 'details' },
        { id: 'c2', text: 'Not my problem.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'hale', text: 'Spices, mostly. High value, easy to fence. They hit the wharf at night and vanish into the alleys before the watch arrives.', choices: [
        { id: 'c3', text: 'I will look into it.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'hale', text: 'Good luck. And watch your coin purse.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Street Rat',
    defaultArchetypeId: 'hustler',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 8, stamina: 6 },
    startingInventory: ['dagger', 'lockpick-set'],
    startingEquipment: { weapon: 'dagger' },
    spawnPointId: 'city-market-spawn',
    tags: ['local'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'hustler', name: 'Hustler', description: 'Knows every shortcut and every con.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['streetwise'], progressionTreeId: 'street-path', grantedVerbs: ['barter', 'pickpocket'] },
      { id: 'enforcer', name: 'Enforcer', description: 'Muscle for hire on the docks.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['tough'], progressionTreeId: 'street-path', grantedVerbs: ['intimidate', 'strike'] },
    ],
    backgrounds: [
      { id: 'orphan', name: 'Dockside Orphan', description: 'Raised by the market and the tide.', statModifiers: { instinct: 1 }, startingTags: ['survivor'] },
    ],
    traits: [
      { id: 'quick-hands', name: 'Quick Hands', description: 'Your fingers move faster than most eyes.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'sleight-of-hand' }] },
      { id: 'marked', name: 'Marked', description: 'A local gang has you on their list.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'street-path', name: 'Street Path', currency: 'xp',
    nodes: [
      { id: 'back-alley-knowledge', name: 'Back Alley Knowledge', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'alley-rat' } }] },
      { id: 'fence-network', name: 'Fence Network', cost: 3, requires: ['back-alley-knowledge'], effects: [{ type: 'grant-verb', params: { verb: 'fence-goods' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'dagger', name: 'Market Dagger', description: 'A short blade hidden easily under a coat.', zoneId: 'market-square', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { instinct: 1 } },
    { itemId: 'lockpick-set', name: 'Lockpick Set', description: 'A leather roll of thin metal tools.', zoneId: 'market-square', hidden: false, slot: 'trinket', rarity: 'uncommon', grantedTags: ['locksmith'] },
  ],

  encounterAnchors: [
    { id: 'alley-mugging', zoneId: 'slums', encounterType: 'brawl', enemyIds: ['gang-lookout'], probability: 0.5, cooldownTurns: 3, tags: ['urban', 'combat'] },
  ],

  factionPresences: [
    { factionId: 'merchant-guild', districtIds: ['dockside'], influence: 60, alertLevel: 40 },
  ],

  pressureHotspots: [
    { id: 'gang-activity', zoneId: 'slums', pressureType: 'pickpocket', baseProbability: 0.6, tags: ['criminal'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── World sample: Iron Steppe ─────────────────────────────────

const worldMap: WorldProject = {
  id: 'world-map',
  name: 'Iron Steppe',
  description: 'A vast grassland where nomadic clans clash over grazing rights and ancient burial mounds.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['epic', 'nomadic'],
  difficulty: 'beginner',
  narratorTone: 'The grass sea stretches to the horizon. Hoofbeats echo across the steppe.',
  mode: 'world',

  map: { id: 'map-1', name: 'The Iron Steppe', description: 'An endless grassland dotted with yurts and burial mounds.', gridWidth: 80, gridHeight: 60, tileSize: 48 },

  zones: [
    { id: 'kingdom-north', name: 'Windcaller Camp', tags: ['settlement', 'safe'], description: 'A sprawling nomadic camp beside a shallow river.', gridX: 20, gridY: 8, gridWidth: 14, gridHeight: 10, neighbors: ['trade-road', 'burial-mounds'], exits: [], light: 9, noise: 4, hazards: [], interactables: [{ name: 'Clan Standard', type: 'inspect', description: 'Horse-hair banners snapping in the wind.' }], parentDistrictId: 'steppe-lands' },
    { id: 'trade-road', name: 'Merchant Trail', tags: ['frontier', 'danger'], description: 'A rutted track where caravans risk everything for profit.', gridX: 30, gridY: 24, gridWidth: 12, gridHeight: 8, neighbors: ['kingdom-north', 'kingdom-south'], exits: [], light: 8, noise: 2, hazards: ['bandits'], interactables: [{ name: 'Overturned Cart', type: 'inspect', description: 'A merchant wagon stripped of its cargo.' }], parentDistrictId: 'steppe-lands' },
    { id: 'kingdom-south', name: 'Ironhold Outpost', tags: ['fortress', 'military'], description: 'A stone outpost built by settlers who refuse to live as nomads.', gridX: 24, gridY: 40, gridWidth: 14, gridHeight: 10, neighbors: ['trade-road'], exits: [], light: 7, noise: 5, hazards: [], interactables: [{ name: 'Armory Door', type: 'use', description: 'A reinforced door leading to the garrison stores.' }], parentDistrictId: 'steppe-lands' },
    { id: 'burial-mounds', name: 'Burial Mounds', tags: ['sacred-region', 'eerie'], description: 'Ancient earthen mounds where ancestors rest and old magic lingers.', gridX: 50, gridY: 14, gridWidth: 10, gridHeight: 10, neighbors: ['kingdom-north'], exits: [], light: 6, noise: 0, hazards: ['superstition'], interactables: [{ name: 'Spirit Cairn', type: 'use', description: 'A pile of painted stones marking a shaman\'s ritual site.' }], parentDistrictId: 'steppe-lands' },
  ],

  connections: [
    { fromZoneId: 'kingdom-north', toZoneId: 'trade-road', bidirectional: true, kind: 'road' },
    { fromZoneId: 'trade-road', toZoneId: 'kingdom-south', bidirectional: true, kind: 'road' },
    { fromZoneId: 'kingdom-north', toZoneId: 'burial-mounds', bidirectional: true, kind: 'passage' },
    { fromZoneId: 'burial-mounds', toZoneId: 'trade-road', bidirectional: false, kind: 'portal' },
  ],

  districts: [{
    id: 'steppe-lands', name: 'The Iron Steppe',
    zoneIds: ['kingdom-north', 'trade-road', 'kingdom-south', 'burial-mounds'],
    tags: ['contested', 'nomadic'],
    baseMetrics: { commerce: 40, morale: 50, safety: 30, stability: 30 },
    economyProfile: { supplyCategories: ['horses', 'hides', 'iron'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'world-map-spawn', zoneId: 'kingdom-north', gridX: 25, gridY: 12, isDefault: true }],

  entityPlacements: [
    { entityId: 'khan-rider', name: 'Khan\'s Rider', zoneId: 'kingdom-north', role: 'quest-giver', dialogueId: 'rider-talk', tags: ['nomad', 'authority'] },
    { entityId: 'caravan-raider', name: 'Steppe Raider', zoneId: 'trade-road', role: 'enemy', tags: ['bandit', 'mounted'] },
  ],

  dialogues: [{
    id: 'rider-talk', speakers: ['rider'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'rider', text: 'The Khan demands tribute from the Ironhold settlers. They have refused. War rides on the wind.', choices: [
        { id: 'c1', text: 'Is there room for negotiation?', nextNodeId: 'details' },
        { id: 'c2', text: 'I ride with the Khan.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'rider', text: 'The burial mounds are contested. The settlers built their outpost on sacred ground. The shamans demand it back.', choices: [
        { id: 'c3', text: 'I will speak to both sides.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'rider', text: 'Ride fast. The steppe waits for no one.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Outrider',
    defaultArchetypeId: 'horseman',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 6 },
    startingInventory: ['steppe-saber', 'waterskin'],
    startingEquipment: { weapon: 'steppe-saber' },
    spawnPointId: 'world-map-spawn',
    tags: ['traveler'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'horseman', name: 'Horseman', description: 'Born in the saddle, dies in the saddle.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['mounted'], progressionTreeId: 'steppe-path', grantedVerbs: ['charge', 'scout'] },
      { id: 'shaman', name: 'Shaman', description: 'Speaks to the spirits of the steppe.', statPriorities: { will: 2, instinct: 1 }, startingTags: ['spiritual'], progressionTreeId: 'steppe-path', grantedVerbs: ['commune', 'ward'] },
    ],
    backgrounds: [
      { id: 'clan-born', name: 'Clan Born', description: 'The steppe is your blood and bone.', statModifiers: { vigor: 1 }, startingTags: ['nomad'] },
    ],
    traits: [
      { id: 'horse-bond', name: 'Horse Bond', description: 'Your mount responds to thought, not command.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'mounted-expert' }] },
      { id: 'steppe-fever', name: 'Steppe Fever', description: 'An old illness that flares in the cold.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'steppe-path', name: 'Steppe Path', currency: 'xp',
    nodes: [
      { id: 'wind-reader', name: 'Wind Reader', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'weather-wise' } }] },
      { id: 'thunder-charge', name: 'Thunder Charge', cost: 3, requires: ['wind-reader'], effects: [{ type: 'grant-verb', params: { verb: 'mounted-charge' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'steppe-saber', name: 'Steppe Saber', description: 'A curved blade made for horseback combat.', zoneId: 'kingdom-north', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'waterskin', name: 'Waterskin', description: 'Essential for surviving the dry steppe.', zoneId: 'kingdom-north', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['provisioned'] },
  ],

  encounterAnchors: [
    { id: 'raider-ambush', zoneId: 'trade-road', encounterType: 'caravan-raid', enemyIds: ['caravan-raider'], probability: 0.6, cooldownTurns: 4, tags: ['military', 'mounted'] },
  ],

  factionPresences: [
    { factionId: 'windcaller-clan', districtIds: ['steppe-lands'], influence: 55, alertLevel: 50 },
  ],

  pressureHotspots: [
    { id: 'clan-tension', zoneId: 'trade-road', pressureType: 'border-conflict', baseProbability: 0.6, tags: ['military'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── Interior sample: Keeper's Lodge ───────────────────────────

const cabinInterior: WorldProject = {
  id: 'cabin-interior',
  name: 'Keeper\'s Lodge',
  description: 'A forest lodge where the keeper guards secrets in the cellar and attic alike.',
  version: '0.1.0',
  genre: 'fantasy',
  tones: ['mysterious', 'cozy'],
  difficulty: 'beginner',
  narratorTone: 'Floorboards creak beneath your weight. The lodge remembers every footstep.',
  mode: 'interior',

  map: { id: 'map-1', name: 'The Keeper\'s Lodge', description: 'A three-story lodge in a forest clearing.', gridWidth: 20, gridHeight: 15, tileSize: 24 },

  zones: [
    { id: 'main-room', name: 'Great Room', tags: ['room', 'safe'], description: 'A warm room with a stone hearth and mounted antlers on the walls.', gridX: 4, gridY: 2, gridWidth: 6, gridHeight: 4, neighbors: ['cellar', 'study', 'attic'], exits: [], light: 7, noise: 2, hazards: [], interactables: [{ name: 'Hearth', type: 'use', description: 'A crackling fire that fills the room with warmth.' }], parentDistrictId: 'lodge-floor' },
    { id: 'cellar', name: 'Root Cellar', tags: ['cellar', 'dark'], description: 'A damp cellar lined with shelves of preserved food and strange jars.', gridX: 4, gridY: 9, gridWidth: 5, gridHeight: 4, neighbors: ['main-room'], exits: [], light: 2, noise: 0, hazards: [], interactables: [{ name: 'Sealed Jar', type: 'inspect', description: 'Something dark and viscous sloshes inside the glass.' }], parentDistrictId: 'lodge-floor' },
    { id: 'study', name: 'Keeper\'s Study', tags: ['room', 'quest'], description: 'A cluttered study filled with maps, journals, and dried herbs.', gridX: 12, gridY: 3, gridWidth: 5, gridHeight: 4, neighbors: ['main-room'], exits: [], light: 5, noise: 0, hazards: [], interactables: [{ name: 'Journal', type: 'inspect', description: 'The keeper\'s journal, open to the last entry.' }], parentDistrictId: 'lodge-floor' },
    { id: 'attic', name: 'Attic Loft', tags: ['room', 'hidden'], description: 'A dusty attic with a locked trunk and a window overlooking the forest.', gridX: 6, gridY: 12, gridWidth: 5, gridHeight: 3, neighbors: ['main-room'], exits: [], light: 3, noise: 0, hazards: [], interactables: [{ name: 'Locked Trunk', type: 'use', description: 'A heavy trunk bound with iron straps and a rusted padlock.' }], parentDistrictId: 'lodge-floor' },
  ],

  connections: [
    { fromZoneId: 'main-room', toZoneId: 'cellar', bidirectional: true, kind: 'stairs' },
    { fromZoneId: 'main-room', toZoneId: 'study', bidirectional: true, kind: 'door' },
    { fromZoneId: 'main-room', toZoneId: 'attic', bidirectional: true, kind: 'stairs' },
    { fromZoneId: 'cellar', toZoneId: 'study', bidirectional: false, kind: 'secret' },
  ],

  districts: [{
    id: 'lodge-floor', name: 'The Lodge',
    zoneIds: ['main-room', 'cellar', 'study', 'attic'],
    tags: ['indoor', 'rustic'],
    baseMetrics: { commerce: 5, morale: 55, safety: 60, stability: 65 },
    economyProfile: { supplyCategories: ['herbs', 'preserves', 'firewood'], scarcityDefaults: {} },
  }],

  landmarks: [],
  spawnPoints: [{ id: 'cabin-interior-spawn', zoneId: 'main-room', gridX: 6, gridY: 4, isDefault: true }],

  entityPlacements: [
    { entityId: 'old-keeper', name: 'Old Keeper Bryn', zoneId: 'main-room', role: 'quest-giver', dialogueId: 'bryn-talk', tags: ['keeper', 'elderly'] },
    { entityId: 'cellar-thing', name: 'Cellar Creeper', zoneId: 'cellar', role: 'enemy', tags: ['creature', 'hidden'] },
  ],

  dialogues: [{
    id: 'bryn-talk', speakers: ['bryn'], entryNodeId: 'greeting',
    nodes: {
      greeting: { id: 'greeting', speaker: 'bryn', text: 'Welcome to the lodge. Mind where you step — not everything here is what it seems.', choices: [
        { id: 'c1', text: 'What do you mean?', nextNodeId: 'details' },
        { id: 'c2', text: 'Nice place.', nextNodeId: 'farewell' },
      ]},
      details: { id: 'details', speaker: 'bryn', text: 'The cellar has been... restless lately. And the trunk in the attic — I locked it for good reason. My study journals will explain more, if you care to read.', choices: [
        { id: 'c3', text: 'I will take a look.', nextNodeId: 'farewell' },
      ]},
      farewell: { id: 'farewell', speaker: 'bryn', text: 'Make yourself at home. But stay out of the cellar after dark.', choices: [] },
    },
  }],

  playerTemplate: {
    name: 'Visitor',
    defaultArchetypeId: 'investigator',
    baseStats: { vigor: 2, instinct: 4, will: 3 },
    baseResources: { hp: 7, stamina: 6 },
    startingInventory: ['fireplace-poker', 'lantern'],
    startingEquipment: { weapon: 'fireplace-poker' },
    spawnPointId: 'cabin-interior-spawn',
    tags: ['visitor'],
    custom: {},
  },

  buildCatalog: {
    statBudget: 10, maxTraits: 3, requiredFlaws: 1,
    archetypes: [
      { id: 'investigator', name: 'Investigator', description: 'Notices what others miss.', statPriorities: { instinct: 2, will: 1 }, startingTags: ['perceptive'], progressionTreeId: 'lodge-path', grantedVerbs: ['search', 'deduce'] },
      { id: 'handyman', name: 'Handyman', description: 'Can fix or break anything with the right tools.', statPriorities: { vigor: 2, instinct: 1 }, startingTags: ['practical'], progressionTreeId: 'lodge-path', grantedVerbs: ['repair', 'pry'] },
    ],
    backgrounds: [
      { id: 'guest', name: 'Wayward Guest', description: 'You came seeking shelter. You found something else.', statModifiers: { will: 1 }, startingTags: ['outsider'] },
    ],
    traits: [
      { id: 'keen-nose', name: 'Keen Nose', description: 'You can smell rot, smoke, and secrets.', category: 'perk', effects: [{ type: 'grant-tag', tag: 'scent-tracker' }] },
      { id: 'claustrophobic', name: 'Claustrophobic', description: 'Tight spaces make your hands shake.', category: 'flaw', effects: [{ type: 'stat-modifier', stat: 'vigor', amount: -1 }] },
    ],
    disciplines: [],
    crossTitles: [],
    entanglements: [],
  },

  progressionTrees: [{
    id: 'lodge-path', name: 'Lodge Path', currency: 'insight',
    nodes: [
      { id: 'keen-observer', name: 'Keen Observer', cost: 2, effects: [{ type: 'grant-tag', params: { tag: 'detail-oriented' } }] },
      { id: 'secret-finder', name: 'Secret Finder', cost: 3, requires: ['keen-observer'], effects: [{ type: 'grant-verb', params: { verb: 'reveal-hidden' } }] },
    ],
  }],

  itemPlacements: [
    { itemId: 'fireplace-poker', name: 'Fireplace Poker', description: 'Heavy iron, good for stirring coals and cracking skulls.', zoneId: 'main-room', hidden: false, slot: 'weapon', rarity: 'common', statModifiers: { vigor: 1 } },
    { itemId: 'lantern', name: 'Oil Lantern', description: 'A brass lantern with a few hours of fuel left.', zoneId: 'main-room', hidden: false, slot: 'trinket', rarity: 'common', grantedTags: ['light-source'] },
  ],

  encounterAnchors: [
    { id: 'cellar-lurker', zoneId: 'cellar', encounterType: 'haunt', enemyIds: ['cellar-thing'], probability: 0.6, cooldownTurns: 3, tags: ['supernatural', 'indoor'] },
  ],

  factionPresences: [
    { factionId: 'forest-keepers', districtIds: ['lodge-floor'], influence: 80, alertLevel: 20 },
  ],

  pressureHotspots: [
    { id: 'cellar-disturbance', zoneId: 'cellar', pressureType: 'trap-activation', baseProbability: 0.4, tags: ['supernatural'] },
  ],

  craftingStations: [], marketNodes: [],
  tilesets: [], tileLayers: [], props: [], propPlacements: [],
  ambientLayers: [], assets: [], assetPacks: [],
};

// ── Exports ───────────────────────────────────────────────────

export const SAMPLE_WORLDS: SampleWorld[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Minimal valid project: 1 zone, 1 spawn, 1 district. The smallest exportable world.',
    complexity: 'minimal',
    mode: 'dungeon',
    project: helloWorld,
  },
  {
    id: 'tavern-crossroads',
    name: 'Tavern Crossroads',
    description: 'A mid-sized starter with player template, build catalog, dialogue, and progression tree.',
    complexity: 'intermediate',
    mode: 'district',
    project: tavernCrossroads,
  },
  {
    id: 'chapel-threshold',
    name: 'Chapel Threshold',
    description: 'Rich reference with factions, encounters, items, build catalog, progression trees, and branching dialogue.',
    complexity: 'rich',
    mode: 'dungeon',
    project: chapelThreshold,
  },
  { id: 'ocean-harbor', name: 'Smuggler\'s Cove', description: 'A hidden cove with smugglers, patrols, and reef shortcuts.', complexity: 'intermediate', mode: 'ocean', project: oceanHarbor },
  { id: 'space-station', name: 'Mining Outpost', description: 'An asteroid mining platform with crew tensions and rogue machinery.', complexity: 'intermediate', mode: 'space', project: spaceStation },
  { id: 'wilderness-trail', name: 'Thornwood Path', description: 'A haunted forest trail with rangers, ruins, and territorial beasts.', complexity: 'intermediate', mode: 'wilderness', project: wildernessTrail },
  { id: 'city-market', name: 'Dockside Market', description: 'A waterfront market district with merchants, gangs, and back-alley trouble.', complexity: 'intermediate', mode: 'district', project: cityMarket },
  { id: 'world-map', name: 'Iron Steppe', description: 'A nomadic grassland with rival clans, caravans, and burial mounds.', complexity: 'intermediate', mode: 'world', project: worldMap },
  { id: 'cabin-interior', name: 'Keeper\'s Lodge', description: 'A forest lodge with secrets in the cellar and mysteries in the attic.', complexity: 'intermediate', mode: 'interior', project: cabinInterior },
];
