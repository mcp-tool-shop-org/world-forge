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

  playerTemplate: {
    name: 'Wanderer',
    defaultArchetypeId: 'wanderer',
    baseStats: { vigor: 3, instinct: 4, will: 2 },
    baseResources: { hp: 12, stamina: 6 },
    startingInventory: ['chapel-lantern'],
    startingEquipment: { weapon: 'rusted-mace' },
    spawnPointId: 'chapel-spawn',
    tags: ['player', 'mortal'],
    custom: { origin: 'unknown', motivation: 'seek-the-relic' },
  },

  buildCatalog: {
    statBudget: 12,
    maxTraits: 4,
    requiredFlaws: 1,
    archetypes: [
      {
        id: 'wanderer',
        name: 'Wanderer',
        description: 'A drifter who survives by instinct and resourcefulness.',
        statPriorities: { instinct: 2, vigor: 1 },
        startingTags: ['traveler', 'resourceful'],
        startingInventory: ['chapel-lantern'],
        progressionTreeId: 'tree-wanderer',
        grantedVerbs: ['scavenge', 'navigate'],
      },
      {
        id: 'zealot',
        name: 'Zealot',
        description: 'A devout warrior who channels faith into fury.',
        statPriorities: { will: 2, vigor: 1 },
        resourceOverrides: { stamina: 8 },
        startingTags: ['faithful', 'militant'],
        startingInventory: [],
        progressionTreeId: 'tree-zealot',
        grantedVerbs: ['smite', 'pray'],
      },
    ],
    backgrounds: [
      {
        id: 'pilgrim',
        name: 'Pilgrim',
        description: 'Traveled the sacred roads. Knows the old prayers.',
        statModifiers: { will: 1 },
        startingTags: ['devout'],
        factionModifiers: { keepers: 10 },
      },
      {
        id: 'exile',
        name: 'Exile',
        description: 'Cast out from a distant settlement. Trusts no one.',
        statModifiers: { instinct: 1 },
        startingTags: ['outcast', 'wary'],
        factionModifiers: { keepers: -5 },
      },
    ],
    traits: [
      {
        id: 'iron-gut',
        name: 'Iron Gut',
        description: 'Resistant to poison and spoiled food.',
        category: 'perk',
        effects: [{ type: 'grant-tag', tag: 'poison-resistant' }],
      },
      {
        id: 'keen-eyes',
        name: 'Keen Eyes',
        description: 'Spots hidden passages and traps.',
        category: 'perk',
        effects: [{ type: 'stat-modifier', stat: 'instinct', amount: 1 }],
      },
      {
        id: 'haunted',
        name: 'Haunted',
        description: 'Nightmares steal your rest. Stamina recovery is reduced.',
        category: 'flaw',
        effects: [{ type: 'resource-modifier', resource: 'stamina', amount: -2 }],
      },
    ],
    disciplines: [
      {
        id: 'shadow-step',
        name: 'Shadow Step',
        description: 'Move unseen through darkness.',
        grantedVerb: 'shadow-step',
        passive: { type: 'grant-tag', tag: 'shadow-attuned' },
        drawback: { type: 'resource-modifier', resource: 'hp', amount: -2 },
        requiredTags: ['traveler'],
      },
    ],
    crossTitles: [
      { archetypeId: 'wanderer', disciplineId: 'shadow-step', title: 'Phantom Drifter', tags: ['phantom'] },
    ],
    entanglements: [
      {
        id: 'entangle-wanderer-shadow',
        archetypeId: 'wanderer',
        disciplineId: 'shadow-step',
        description: 'The wanderer becomes one with the dark.',
        effects: [{ type: 'stat-modifier', stat: 'instinct', amount: 1 }],
      },
    ],
  },

  progressionTrees: [
    {
      id: 'tree-wanderer',
      name: 'Path of the Wanderer',
      currency: 'xp',
      nodes: [
        {
          id: 'keen-senses',
          name: 'Keen Senses',
          cost: 10,
          effects: [{ type: 'stat-boost', target: 'actor', params: { stat: 'instinct', amount: 1 } }],
        },
        {
          id: 'survivors-luck',
          name: "Survivor's Luck",
          description: 'Fortune favors those who endure.',
          cost: 20,
          requires: ['keen-senses'],
          effects: [{ type: 'grant-tag', target: 'actor', params: { tag: 'lucky' } }],
        },
        {
          id: 'trailblazer',
          name: 'Trailblazer',
          description: 'Move faster through wilderness zones.',
          cost: 30,
          requires: ['keen-senses'],
          effects: [{ type: 'grant-verb', target: 'actor', params: { verb: 'sprint' } }],
        },
      ],
    },
    {
      id: 'tree-zealot',
      name: 'Path of the Zealot',
      currency: 'xp',
      nodes: [
        {
          id: 'righteous-fury',
          name: 'Righteous Fury',
          cost: 10,
          effects: [{ type: 'stat-boost', target: 'actor', params: { stat: 'will', amount: 1 } }],
        },
        {
          id: 'divine-shield',
          name: 'Divine Shield',
          description: 'A prayer that absorbs one blow.',
          cost: 25,
          requires: ['righteous-fury'],
          effects: [{ type: 'grant-tag', target: 'actor', params: { tag: 'shielded' } }],
        },
      ],
    },
  ],

  dialogues: [
    {
      id: 'pilgrim-talk',
      speakers: ['suspicious-pilgrim'],
      entryNodeId: 'greeting',
      nodes: {
        greeting: {
          id: 'greeting',
          speaker: 'Suspicious Pilgrim',
          text: 'You should not be here. The chapel is... changed. Something stirs below.',
          choices: [
            { id: 'ask-what', text: 'What stirs below?', nextNodeId: 'warn-crypt' },
            { id: 'ask-relic', text: 'I seek the relic.', nextNodeId: 'relic-info' },
            { id: 'leave', text: 'I can handle myself.', nextNodeId: 'dismiss' },
          ],
        },
        'warn-crypt': {
          id: 'warn-crypt',
          speaker: 'Suspicious Pilgrim',
          text: 'An ash ghoul. Once a brother of this order. Now it guards the crypt with hollow fury. Take this, you may need it.',
          choices: [
            {
              id: 'accept',
              text: 'I accept your gift.',
              nextNodeId: 'end-gift',
              effects: [{ type: 'set-global', target: 'actor', params: { key: 'pilgrim-warned', value: true } }],
            },
          ],
        },
        'relic-info': {
          id: 'relic-info',
          speaker: 'Suspicious Pilgrim',
          text: 'The Ember Sigil rests in the crypt alcove, beyond the vestry. But the ghoul will not let you pass without a fight.',
          choices: [
            {
              id: 'thanks',
              text: 'Thank you for the warning.',
              nextNodeId: 'end-info',
              effects: [{ type: 'set-global', target: 'actor', params: { key: 'pilgrim-warned', value: true } }],
            },
          ],
        },
        dismiss: {
          id: 'dismiss',
          speaker: 'Suspicious Pilgrim',
          text: 'Confidence is not armor. Remember that.',
        },
        'end-gift': {
          id: 'end-gift',
          speaker: 'Suspicious Pilgrim',
          text: 'A healing draught. May it serve you well. Go with caution.',
        },
        'end-info': {
          id: 'end-info',
          speaker: 'Suspicious Pilgrim',
          text: 'Be careful, wanderer. The dead here do not rest easily.',
        },
      },
    },
  ],

  entityPlacements: [
    {
      entityId: 'suspicious-pilgrim', name: 'Suspicious Pilgrim',
      zoneId: 'chapel-entrance', role: 'npc', dialogueId: 'pilgrim-talk',
      stats: { vigor: 2, instinct: 3, will: 6 },
      resources: { hp: 8 },
    },
    {
      entityId: 'brother-aldric', name: 'Brother Aldric',
      zoneId: 'chapel-nave', role: 'companion', factionId: 'chapel-order',
      stats: { vigor: 3, instinct: 3, will: 7 },
      resources: { hp: 12 },
      tags: ['recruitable', 'healer'],
      custom: { companionRole: 'healer', companionAbilities: 'medical-support,witness-calming', personalGoal: 'Redeem the fallen brothers of the chapel' },
    },
    {
      entityId: 'sister-maren', name: 'Sister Maren',
      zoneId: 'chapel-alcove', role: 'npc', factionId: 'chapel-order',
      stats: { vigor: 2, instinct: 5, will: 5 },
      resources: { hp: 10 },
      tags: ['recruitable', 'diplomat'],
      custom: { companionRole: 'diplomat', companionAbilities: 'faction-route,scholarly-insight', personalGoal: 'Recover the chapel archives from the crypt' },
    },
    {
      entityId: 'ash-ghoul', name: 'Ash Ghoul',
      zoneId: 'crypt-chamber', role: 'boss', factionId: 'chapel-undead',
      stats: { vigor: 4, instinct: 3, will: 1 },
      resources: { hp: 12, stamina: 4 },
      tags: ['undead'],
      ai: { profileId: 'aggressive', goals: ['guard-crypt'], fears: ['fire', 'sacred'] },
    },
  ],

  itemPlacements: [
    {
      itemId: 'rusted-mace', name: 'Rusted Mace', zoneId: 'chapel-nave', hidden: false,
      description: 'A pitted mace found near a collapsed grave.',
      slot: 'weapon', rarity: 'common',
      statModifiers: { vigor: 1 }, grantedTags: ['armed'], grantedVerbs: ['strike'],
    },
    {
      itemId: 'chapel-lantern', name: 'Chapel Lantern', zoneId: 'chapel-entrance', hidden: false,
      description: 'A flickering lantern blessed by a forgotten saint.',
      slot: 'tool', rarity: 'common',
      grantedTags: ['light-bearer'], grantedVerbs: ['illuminate'],
    },
    {
      itemId: 'bone-talisman', name: 'Bone Talisman', zoneId: 'crypt-chamber', container: 'stone-coffin', hidden: true,
      description: 'A charm carved from the rib of a restless dead.',
      slot: 'trinket', rarity: 'uncommon',
      statModifiers: { will: 1 }, grantedTags: ['ward-undead'],
    },
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
  assets: [],
  assetPacks: [],
};
