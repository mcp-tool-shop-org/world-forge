// vocabulary-coverage.ts — the C0 alignment-audit instrument fixture.
//
// ONE WorldProject that populates EVERY field on the `project.ts` master list
// at least once, so the export differ can classify each authored field against
// the exported ContentPack without any "the fixture never exercised it" holes.
//
// This fixture is an AUDIT INSTRUMENT, not example content. Two properties are
// load-bearing and must survive any edit:
//
//   1. **Total coverage.** Every optional field on `WorldProject`, `Zone`,
//      `District`, `EntityPlacement`, `ItemPlacement`, and every additive v4.3 /
//      v4.5 domain (strata, stratumLinks, hazardDefinitions, lootTables,
//      transitions, buildings, hubs, strongholds) carries a value. A field left
//      undefined here is a field the export table cannot classify.
//   2. **Determinism.** No clock, no RNG, no environment reads. `exportToEngine`
//      on this fixture must be byte-identical across runs.
//
// The zone `entryGate` conditions collectively use every operand family in the
// SpawnCondition grammar (spawn-condition.ts) — party-level, party-size, item,
// flag, member, class, plus the original level/faction/quest/time/random/
// always/never forms, which appear on entity spawnConditions and loot-table
// entry conditions. See `ALL_SPAWN_CONDITION_OPERANDS` below.

import type { WorldProject } from '@world-forge/schema';

/**
 * Every operand family the SpawnCondition grammar parses (spawn-condition.ts).
 * The fixture places each of these on at least one authored condition field so
 * the audit can prove what the export lane does with the whole grammar, not
 * just the sample the editor happens to emit.
 */
export const ALL_SPAWN_CONDITION_OPERANDS = [
  'always',
  'never',
  'random:0.25',
  'time:night',
  'quest:vault-key:opened',
  'faction:tidewardens:>50',
  'level:>=5',
  'party-level:>=10',
  'party-size:>=3',
  'item:rope',
  'flag:bridge-repaired',
  'member:npc-quartermaster',
  'class:delver',
] as const;

export const vocabularyCoverageProject: WorldProject = {
  // ── Project identity ──────────────────────────────────────────
  id: 'c0-vocabulary-coverage',
  name: 'C0 Vocabulary Coverage',
  description: 'Audit instrument: every authorable WorldProject field, populated once.',
  version: '1.0.0',

  genre: 'fantasy',
  tones: ['dark', 'eerie'],
  difficulty: 'intermediate',
  narratorTone: 'A surveyor reads the world back to you, field by field.',
  mode: 'district',

  author: 'mcp-tool-shop',
  license: 'MIT',
  // Deliberately NOT 'fantasy'. An audit fixture must give every dropped field
  // a distinguishable value: while `category` held the same string as `genre`,
  // no proof could separate "category is dropped" from "category is carried
  // into packMeta.genres" — the differ correctly refused to certify it.
  category: 'harbour-survey',
  projectTags: ['audit', 'coverage', 'c0'],

  // ── Map ───────────────────────────────────────────────────────
  map: {
    id: 'map-coverage',
    name: 'Coverage Map',
    description: 'A three-stratum survey map.',
    gridWidth: 48,
    gridHeight: 48,
    tileSize: 32,
  },

  // ── Zones — every Zone field populated across the three ───────
  zones: [
    {
      // Surface zone: physics + sky + collision + parallax + skyline.
      id: 'zone-surface-yard',
      name: 'Surface Yard',
      tags: ['outdoor', 'safe', 'town'],
      description: 'A cobbled yard open to the sky.',
      gridX: 0,
      gridY: 0,
      gridWidth: 16,
      gridHeight: 16,
      neighbors: ['zone-under-vault'],
      exits: [
        { targetZoneId: 'zone-under-vault', label: 'vault stair', condition: 'item:rope' },
      ],
      light: 9,
      noise: 4,
      hazards: ['loose cobbles'],
      interactables: [
        { name: 'notice board', type: 'inspect', description: 'Bounties, curled at the edges.' },
        { name: 'well', type: 'use', description: 'Rope-burned stone lip.' },
      ],
      parentDistrictId: 'district-harbourside',
      backgroundId: 'asset-bg-yard',
      // NOTE: `Zone.tilesetId` is validated as an ASSET id of kind 'tileset'
      // (validate.ts:680), NOT as a `Tileset.id` from `project.tilesets`.
      // Recorded as a schema observation in the C0 report, not patched here.
      tilesetId: 'asset-tileset-stone',
      elevation: 0,
      elevationRange: { floor: 0, ceiling: 6 },
      stratumId: 'stratum-surface',
      hazardRefs: ['hazard-scalding-steam'],
      entryGate: {
        conditions: ['party-size:>=3', 'flag:bridge-repaired'],
        mode: 'soft',
        reason: 'The yard gate needs three hands on the winch.',
      },
      parallaxLayers: [
        { id: 'plx-far-hills', depth: 3, assetRef: 'asset-bg-hills', scrollFactor: 0.2 },
        { id: 'plx-near-fence', depth: 1, assetRef: 'asset-bg-fence', scrollFactor: 0.8 },
      ],
      skylineRef: 'asset-bg-skyline',
      gravityOverride: 9.81,
      gravityDirection: 'down',
      physicsMode: 'normal',
      skyAtmosphereRef: 'asset-sky-overcast',
      directionalLightYaw: 135,
      directionalLightPitch: -42,
      skyLightIntensity: 1.2,
      timeOfDay: 'dusk',
      collisionType: 'walkable',
    },
    {
      // Underground zone: hard entry gate, typed hazards, aquatic physics.
      id: 'zone-under-vault',
      name: 'Undervault',
      tags: ['indoor', 'dark', 'underground', 'chokepoint'],
      description: 'A flooded vault under the yard.',
      gridX: 0,
      gridY: 16,
      gridWidth: 16,
      gridHeight: 16,
      neighbors: ['zone-surface-yard', 'zone-sky-gantry'],
      exits: [
        { targetZoneId: 'zone-surface-yard', label: 'stair up', condition: 'always' },
        { targetZoneId: 'zone-sky-gantry', label: 'shaft ladder', condition: 'party-level:>=10' },
      ],
      light: 1,
      noise: 2,
      hazards: ['standing water'],
      interactables: [
        { name: 'sealed door', type: 'enter', description: 'Iron, swollen shut.' },
      ],
      parentDistrictId: 'district-harbourside',
      backgroundId: 'asset-bg-vault',
      tilesetId: 'asset-tileset-stone',
      elevation: -8,
      elevationRange: { floor: -12, ceiling: -4 },
      stratumId: 'stratum-under',
      hazardRefs: ['hazard-black-water', 'hazard-void-drop'],
      entryGate: {
        conditions: ['item:rope', 'class:delver', 'member:npc-quartermaster'],
        mode: 'hard',
        reason: 'No one goes down without rope and a delver.',
      },
      parallaxLayers: [
        { id: 'plx-vault-dust', depth: 2, assetRef: 'asset-bg-dust', scrollFactor: 0.4 },
      ],
      skylineRef: 'asset-bg-vault-ceiling',
      gravityOverride: 4.9,
      gravityDirection: 'down',
      physicsMode: 'aquatic',
      // NOTE: `skyAtmosphereRef` has NO referential check in validateProject —
      // unlike backgroundId / tilesetId / skylineRef / parallax assetRef. A
      // finding for the C0 report, not patched here.
      skyAtmosphereRef: 'asset-sky-none',
      directionalLightYaw: 0,
      directionalLightPitch: -90,
      skyLightIntensity: 0.05,
      timeOfDay: 'night',
      collisionType: 'water',
    },
    {
      // Sky zone: zero-g, upward gravity, hazard passability.
      id: 'zone-sky-gantry',
      name: 'Sky Gantry',
      tags: ['outdoor', 'high', 'ambush'],
      description: 'A gantry strung between two towers.',
      gridX: 16,
      gridY: 0,
      gridWidth: 16,
      gridHeight: 16,
      neighbors: ['zone-under-vault'],
      exits: [
        { targetZoneId: 'zone-under-vault', label: 'drop shaft', condition: 'flag:bridge-repaired' },
      ],
      light: 7,
      noise: 6,
      hazards: ['crosswind'],
      interactables: [
        { name: 'signal lamp', type: 'talk', description: 'Shuttered brass.' },
        { name: 'nothing here', type: 'none' },
      ],
      parentDistrictId: 'district-upper-works',
      backgroundId: 'asset-bg-gantry',
      tilesetId: 'asset-tileset-iron',
      elevation: 42,
      elevationRange: { floor: 40, ceiling: 46 },
      stratumId: 'stratum-sky',
      hazardRefs: ['hazard-void-drop'],
      entryGate: {
        conditions: ['party-level:>=10', 'party-size:>=3'],
        mode: 'hard',
        reason: 'The gantry will not hold a green party.',
      },
      parallaxLayers: [
        { id: 'plx-cloud', depth: 4, assetRef: 'asset-bg-cloud', scrollFactor: 0.1 },
      ],
      skylineRef: 'asset-bg-skyline',
      gravityOverride: 0,
      gravityDirection: 'up',
      physicsMode: 'zero-g',
      skyAtmosphereRef: 'asset-sky-clear',
      directionalLightYaw: 270,
      directionalLightPitch: -10,
      skyLightIntensity: 2,
      timeOfDay: 'day',
      collisionType: 'void',
    },
  ],

  // ── Connections — every ConnectionKind axis exercised ─────────
  connections: [
    {
      fromZoneId: 'zone-surface-yard',
      toZoneId: 'zone-under-vault',
      label: 'vault stair',
      kind: 'stairs',
      bidirectional: true,
      condition: 'item:rope',
    },
    {
      fromZoneId: 'zone-under-vault',
      toZoneId: 'zone-sky-gantry',
      label: 'shaft ladder',
      kind: 'secret',
      bidirectional: false,
      condition: 'party-level:>=10',
    },
  ],

  // ── Districts — economyProfile populated on both ──────────────
  districts: [
    {
      id: 'district-harbourside',
      name: 'Harbourside',
      zoneIds: ['zone-surface-yard', 'zone-under-vault'],
      tags: ['docks', 'poor'],
      controllingFaction: 'tidewardens',
      baseMetrics: { commerce: 55, morale: 35, safety: 40, stability: 45 },
      economyProfile: {
        supplyCategories: ['food', 'rope', 'salvage'],
        scarcityDefaults: { food: 0.4, rope: 0.2, salvage: 0.7 },
      },
    },
    {
      id: 'district-upper-works',
      name: 'Upper Works',
      zoneIds: ['zone-sky-gantry'],
      tags: ['industrial', 'guarded'],
      controllingFaction: 'gantry-guild',
      baseMetrics: { commerce: 70, morale: 60, safety: 75, stability: 65 },
      economyProfile: {
        supplyCategories: ['iron', 'tools'],
        scarcityDefaults: { iron: 0.15, tools: 0.3 },
      },
    },
  ],

  // ── Landmarks ─────────────────────────────────────────────────
  landmarks: [
    {
      id: 'lm-tide-stone',
      name: 'Tide Stone',
      zoneId: 'zone-surface-yard',
      gridX: 4,
      gridY: 4,
      tags: ['sacred', 'marker'],
      description: 'A salt-pitted stone marking high water.',
      interactionType: 'inspect',
      iconId: 'asset-icon-stone',
    },
    {
      id: 'lm-guild-seal',
      name: 'Guild Seal',
      zoneId: 'zone-sky-gantry',
      gridX: 20,
      gridY: 6,
      tags: ['faction'],
      description: 'The gantry guild seal, cast in brass.',
      interactionType: 'use',
      iconId: 'asset-icon-seal',
    },
  ],

  // ── Faction presence + pressure ──────────────────────────────
  factionPresences: [
    {
      factionId: 'tidewardens',
      districtIds: ['district-harbourside'],
      influence: 65,
      alertLevel: 25,
      patrolRoutes: [{ zoneIds: ['zone-surface-yard', 'zone-under-vault'] }],
    },
    {
      factionId: 'gantry-guild',
      districtIds: ['district-upper-works'],
      influence: 80,
      alertLevel: 45,
      patrolRoutes: [{ zoneIds: ['zone-sky-gantry'] }],
    },
  ],

  pressureHotspots: [
    {
      id: 'ph-vault',
      zoneId: 'zone-under-vault',
      pressureType: 'flooding',
      baseProbability: 0.35,
      tags: ['water', 'structural'],
    },
  ],

  // ── Dialogue — conditions + effects on choices and nodes ──────
  dialogues: [
    {
      id: 'dlg-quartermaster',
      speakers: ['npc-quartermaster'],
      entryNodeId: 'greet',
      nodes: {
        greet: {
          id: 'greet',
          speaker: 'Quartermaster',
          text: 'Rope is three marks. Down is free.',
          choices: [
            {
              id: 'buy-rope',
              text: 'I will take the rope.',
              nextNodeId: 'sold',
              condition: { type: 'faction-rep', params: { id: 'tidewardens', op: '>', value: 0 } },
              effects: [{ type: 'grant-item', target: 'actor', params: { itemId: 'item-rope' } }],
            },
            { id: 'leave', text: 'Another time.', nextNodeId: 'end' },
          ],
          effects: [{ type: 'set-flag', target: 'zone', params: { flag: 'met-quartermaster' } }],
        },
        sold: {
          id: 'sold',
          speaker: 'Quartermaster',
          text: 'Mind the third rung.',
          nextNodeId: 'end',
          effects: [{ type: 'adjust-standing', target: 'actor', params: { faction: 'tidewardens', amount: 2 } }],
        },
        end: { id: 'end', speaker: 'Quartermaster', text: 'Go on, then.' },
      },
    },
  ],

  // ── Player template — every field ─────────────────────────────
  playerTemplate: {
    name: 'Surveyor',
    defaultArchetypeId: 'arch-delver',
    defaultBackgroundId: 'bg-dockhand',
    baseStats: { vigor: 3, instinct: 4, will: 3 },
    baseResources: { hp: 12, stamina: 6 },
    startingInventory: ['item-rope', 'item-lantern'],
    startingEquipment: { tool: 'item-lantern' },
    spawnPointId: 'sp-yard',
    tags: ['player', 'surveyor'],
    custom: { chronicle: true, ledgerSeed: 7, house: 'tidewardens' },
  },

  // ── Build catalog — every sub-array populated ─────────────────
  buildCatalog: {
    statBudget: 12,
    maxTraits: 2,
    requiredFlaws: 1,
    archetypes: [
      {
        id: 'arch-delver',
        name: 'Delver',
        description: 'Goes down where the maps stop.',
        statPriorities: { vigor: 2, instinct: 3, will: 1 },
        resourceOverrides: { stamina: 8 },
        startingTags: ['delver'],
        startingInventory: ['item-rope'],
        progressionTreeId: 'tree-delving',
        grantedVerbs: ['rappel'],
      },
    ],
    backgrounds: [
      {
        id: 'bg-dockhand',
        name: 'Dockhand',
        description: 'Hauled rope before you carried it.',
        statModifiers: { vigor: 1 },
        startingTags: ['dockhand'],
        startingInventory: ['item-lantern'],
        factionModifiers: { tidewardens: 10 },
      },
    ],
    traits: [
      {
        id: 'trait-sure-footed',
        name: 'Sure-Footed',
        description: 'Wet stone does not frighten you.',
        category: 'perk',
        effects: [{ type: 'stat-modifier', stat: 'vigor', amount: 1 }],
        incompatibleWith: ['trait-vertigo'],
      },
      {
        id: 'trait-vertigo',
        name: 'Vertigo',
        description: 'Height turns your stomach.',
        category: 'flaw',
        effects: [{ type: 'stat-modifier', stat: 'will', amount: -1 }],
        incompatibleWith: ['trait-sure-footed'],
      },
    ],
    disciplines: [
      {
        id: 'disc-shoring',
        name: 'Shoring',
        description: 'You brace what others flee.',
        grantedVerb: 'shore',
        passive: { type: 'resource-modifier', resource: 'stamina', amount: 2 },
        drawback: { type: 'stat-modifier', stat: 'instinct', amount: -1 },
        requiredTags: ['delver'],
      },
    ],
    crossTitles: [
      {
        archetypeId: 'arch-delver',
        disciplineId: 'disc-shoring',
        title: 'Pitwright',
        tags: ['title', 'delver'],
      },
    ],
    entanglements: [
      {
        id: 'ent-pitwright',
        archetypeId: 'arch-delver',
        disciplineId: 'disc-shoring',
        description: 'Bracing a shaft you already know pays double.',
        effects: [{ type: 'grant-tag', tag: 'pitwright' }],
      },
    ],
  },

  // ── Progression trees ─────────────────────────────────────────
  progressionTrees: [
    {
      id: 'tree-delving',
      name: 'Delving',
      currency: 'insight',
      nodes: [
        {
          id: 'node-rope-sense',
          name: 'Rope Sense',
          description: 'You feel a bad knot before it slips.',
          cost: 1,
          effects: [{ type: 'stat-modifier', target: 'actor', params: { stat: 'instinct', amount: 1 } }],
        },
        {
          id: 'node-deep-lungs',
          name: 'Deep Lungs',
          description: 'Flooded galleries stop being a wall.',
          cost: 2,
          requires: ['node-rope-sense'],
          effects: [{ type: 'resource-modifier', target: 'actor', params: { resource: 'stamina', amount: 2 } }],
        },
      ],
    },
  ],

  // ── Entities — every EntityPlacement field ────────────────────
  entityPlacements: [
    {
      entityId: 'npc-quartermaster',
      name: 'Quartermaster Hale',
      zoneId: 'zone-surface-yard',
      gridX: 6,
      gridY: 3,
      role: 'merchant',
      spawnCondition: 'time:night',
      factionId: 'tidewardens',
      dialogueId: 'dlg-quartermaster',
      stats: { vigor: 2, instinct: 4, will: 4 },
      resources: { hp: 10, stamina: 4 },
      ai: { profileId: 'cautious', goals: ['sell-rope'], fears: ['flooding'] },
      tags: ['merchant', 'named'],
      custom: { stall: 'north-arch' },
      portraitId: 'asset-portrait-hale',
      spriteId: 'asset-sprite-hale',
    },
    {
      entityId: 'enemy-vault-drowned',
      name: 'The Drowned',
      zoneId: 'zone-under-vault',
      gridX: 8,
      gridY: 20,
      role: 'boss',
      spawnCondition: 'quest:vault-key:opened',
      factionId: 'tidewardens',
      stats: { vigor: 6, instinct: 3, will: 5 },
      resources: { hp: 30, stamina: 8 },
      ai: { profileId: 'aggressive', goals: ['drown-intruders'], fears: ['lantern-light'] },
      tags: ['boss', 'undead'],
      custom: { chronicleKey: 'drowned' },
      portraitId: 'asset-portrait-drowned',
      spriteId: 'asset-sprite-drowned',
    },
    {
      entityId: 'npc-gantry-runner',
      name: 'Runner Vess',
      zoneId: 'zone-sky-gantry',
      gridX: 22,
      gridY: 4,
      role: 'companion',
      spawnCondition: 'level:>=5',
      factionId: 'gantry-guild',
      stats: { vigor: 3, instinct: 5, will: 2 },
      resources: { hp: 11, stamina: 7 },
      ai: { profileId: 'skirmisher', goals: ['scout-ahead'], fears: ['heights'] },
      tags: ['companion'],
      custom: { recruitCost: '3' },
      portraitId: 'asset-portrait-vess',
      spriteId: 'asset-sprite-vess',
    },
  ],

  // ── Items — every ItemPlacement field ─────────────────────────
  itemPlacements: [
    {
      itemId: 'item-rope',
      name: 'Tarred Rope',
      description: 'Forty feet, tarred against the wet.',
      zoneId: 'zone-surface-yard',
      gridX: 7,
      gridY: 3,
      container: 'stall crate',
      hidden: false,
      slot: 'tool',
      rarity: 'common',
      statModifiers: { vigor: 1 },
      resourceModifiers: { stamina: 1 },
      grantedTags: ['roped'],
      grantedVerbs: ['rappel'],
      iconId: 'asset-icon-rope',
      lootTableId: 'loot-vault-silt',
    },
    {
      itemId: 'item-lantern',
      name: 'Shuttered Lantern',
      description: 'Burns low and long.',
      zoneId: 'zone-under-vault',
      gridX: 3,
      gridY: 19,
      container: 'silt',
      hidden: true,
      slot: 'accessory',
      rarity: 'uncommon',
      statModifiers: { instinct: 1 },
      resourceModifiers: {},
      grantedTags: ['lit'],
      grantedVerbs: [],
      iconId: 'asset-icon-lantern',
    },
    {
      // Deliberately exercises two lossy export branches the other two items
      // do not reach:
      //   * slot 'consumable' is a legal `ItemSlot` in the schema but is NOT in
      //     convert-items' VALID_ITEM_SLOTS, so it is silently narrowed.
      //   * `description` is omitted, which is the ONLY case where `container`
      //     survives export (folded into the generated description string).
      itemId: 'item-tide-ration',
      name: 'Tide Ration',
      zoneId: 'zone-sky-gantry',
      gridX: 19,
      gridY: 5,
      container: 'gantry locker',
      hidden: false,
      slot: 'consumable',
      rarity: 'common',
      statModifiers: {},
      resourceModifiers: { stamina: 2 },
      grantedTags: [],
      grantedVerbs: [],
      iconId: 'asset-icon-ration',
    },
  ],

  // ── Encounter anchors ─────────────────────────────────────────
  encounterAnchors: [
    {
      id: 'enc-vault',
      zoneId: 'zone-under-vault',
      encounterType: 'ambush',
      enemyIds: ['enemy-vault-drowned'],
      probability: 0.45,
      cooldownTurns: 4,
      tags: ['undead', 'water'],
    },
  ],

  // ── Spawn points ──────────────────────────────────────────────
  spawnPoints: [
    { id: 'sp-yard', zoneId: 'zone-surface-yard', gridX: 2, gridY: 2, isDefault: true },
    { id: 'sp-gantry', zoneId: 'zone-sky-gantry', gridX: 18, gridY: 2, isDefault: false },
  ],

  // ── Crafting stations ─────────────────────────────────────────
  craftingStations: [
    {
      id: 'station-ropewalk',
      zoneId: 'zone-surface-yard',
      stationType: 'ropewalk',
      availableRecipes: ['recipe-splice-rope', 'recipe-tar-line'],
    },
  ],

  // ── Market nodes ──────────────────────────────────────────────
  marketNodes: [
    {
      id: 'market-yard-stall',
      zoneId: 'zone-surface-yard',
      merchantEntityId: 'npc-quartermaster',
      supplyCategories: ['rope', 'food'],
      priceModifier: 1.15,
      contrabandAvailable: true,
    },
  ],

  // ── Town structures (v4.5) ────────────────────────────────────
  buildings: [
    {
      id: 'bld-harbour-office',
      name: 'Harbour Office',
      buildingType: 'office',
      gridX: 2,
      gridY: 8,
      width: 4,
      height: 3,
      zoneId: 'zone-surface-yard',
      interiorZoneId: 'zone-under-vault',
      tags: ['civic', 'enterable'],
    },
  ],

  hubs: [
    {
      id: 'hub-yard-square',
      name: 'Yard Square',
      zoneId: 'zone-surface-yard',
      hubType: 'market-square',
      serviceTypes: ['market', 'tavern'],
      connectedZoneIds: ['zone-under-vault'],
      tags: ['hub', 'busy'],
    },
  ],

  strongholds: [
    {
      id: 'hold-gantry-keep',
      name: 'Gantry Keep',
      zoneId: 'zone-sky-gantry',
      factionId: 'gantry-guild',
      defenseLevel: 4,
      garrisonEntityIds: ['npc-gantry-runner'],
      tags: ['fortified'],
    },
  ],

  // ── Strata (v4.5) ─────────────────────────────────────────────
  strata: [
    {
      id: 'stratum-under',
      name: 'Undervaults',
      order: -1,
      zRange: { floor: -14, ceiling: -2 },
      visibleStrata: ['stratum-surface'],
      tags: ['flooded'],
    },
    {
      id: 'stratum-surface',
      name: 'Surface',
      order: 0,
      zRange: { floor: -1, ceiling: 8 },
      visibleStrata: ['stratum-under', 'stratum-sky'],
      tags: ['default'],
    },
    {
      id: 'stratum-sky',
      name: 'Gantries',
      order: 1,
      zRange: { floor: 38, ceiling: 50 },
      visibleStrata: ['stratum-surface'],
      tags: ['exposed'],
    },
  ],

  stratumLinks: [
    {
      id: 'link-vault-stair',
      fromStratumId: 'stratum-surface',
      toStratumId: 'stratum-under',
      fromZoneId: 'zone-surface-yard',
      toZoneId: 'zone-under-vault',
      bidirectional: true,
      linkType: 'stairs',
    },
    {
      id: 'link-shaft',
      fromStratumId: 'stratum-under',
      toStratumId: 'stratum-sky',
      fromZoneId: 'zone-under-vault',
      toZoneId: 'zone-sky-gantry',
      bidirectional: false,
      linkType: 'shaft',
    },
  ],

  // ── Typed hazards (v4.5) — one per HazardEffect kind ───────────
  hazardDefinitions: [
    {
      id: 'hazard-scalding-steam',
      name: 'Scalding Steam',
      effects: [
        {
          kind: 'damage',
          amount: 0.05,
          amountIsPercentMaxHp: true,
          tickOn: 'turn-end',
          durationTicks: 3,
        },
      ],
      trigger: 'per-turn',
      moveCostDelta: 1,
      passable: 'yes',
      blocksVision: true,
      weatherConditions: ['cold'],
      immuneTags: ['heat-resist'],
      tags: ['heat', 'vision'],
    },
    {
      id: 'hazard-black-water',
      name: 'Black Water',
      effects: [
        { kind: 'status', statusId: 'status-chilled', chance: 0.5, stacking: 'refresh' },
        { kind: 'ignite', igniteChance: 0 },
      ],
      trigger: 'on-enter',
      moveCostDelta: 2,
      passable: 'flying-only',
      blocksVision: false,
      weatherConditions: [],
      immuneTags: ['cold-immune'],
      tags: ['water', 'cold'],
    },
    {
      id: 'hazard-void-drop',
      name: 'Void Drop',
      effects: [{ kind: 'instakill' }],
      trigger: 'on-exit',
      moveCostDelta: 0,
      passable: 'never',
      blocksVision: false,
      weatherConditions: ['storm'],
      immuneTags: ['flight'],
      tags: ['fall', 'lethal'],
    },
    {
      id: 'hazard-timed-collapse',
      name: 'Timed Collapse',
      effects: [{ kind: 'damage', amount: 4, tickOn: 'turn-start' }],
      trigger: 'timed',
      tags: ['structural'],
    },
  ],

  // ── Visual layer ──────────────────────────────────────────────
  tilesets: [
    {
      id: 'tileset-stone',
      name: 'Wet Stone',
      tileWidth: 32,
      tileHeight: 32,
      imagePath: 'tiles/stone.png',
      imageWidth: 256,
      imageHeight: 256,
      tiles: [
        { id: 'tile-cobble', tilesetId: 'tileset-stone', row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
        { id: 'tile-wall', tilesetId: 'tileset-stone', row: 0, col: 1, tags: ['wall'], walkable: false, opacity: 1 },
      ],
    },
    {
      id: 'tileset-iron',
      name: 'Gantry Iron',
      tileWidth: 32,
      tileHeight: 32,
      imagePath: 'tiles/iron.png',
      imageWidth: 128,
      imageHeight: 128,
      tiles: [
        { id: 'tile-grate', tilesetId: 'tileset-iron', row: 0, col: 0, tags: ['floor', 'metal'], walkable: true, opacity: 0.8 },
      ],
    },
  ],

  tileLayers: [
    {
      id: 'layer-ground',
      name: 'Ground',
      zIndex: 0,
      tiles: [
        { tileId: 'tile-cobble', gridX: 0, gridY: 0 },
        { tileId: 'tile-cobble', gridX: 1, gridY: 0 },
      ],
    },
    {
      id: 'layer-walls',
      name: 'Walls',
      zIndex: 1,
      tiles: [{ tileId: 'tile-wall', gridX: 0, gridY: 1 }],
    },
  ],

  props: [
    {
      id: 'prop-crate',
      name: 'Crate',
      imagePath: 'props/crate.png',
      width: 32,
      height: 32,
      tags: ['container'],
      walkable: false,
      interactable: true,
    },
  ],

  propPlacements: [
    { id: 'pp-crate-yard', propId: 'prop-crate', gridX: 5, gridY: 2, zoneId: 'zone-surface-yard' },
  ],

  ambientLayers: [
    {
      id: 'amb-vault-fog',
      name: 'Vault Fog',
      zoneIds: ['zone-under-vault'],
      type: 'fog',
      intensity: 0.6,
      color: '#3a4a52',
    },
  ],

  // ── Assets ────────────────────────────────────────────────────
  assets: [
    {
      id: 'asset-bg-yard',
      kind: 'background',
      label: 'Surface Yard',
      path: 'bg/yard.png',
      version: '1.0.0',
      tags: ['outdoor'],
      provenance: {
        source: 'ai-generated',
        author: 'mcp-tool-shop',
        license: 'CC-BY-4.0',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      packId: 'pack-harbour',
    },
    { id: 'asset-bg-vault', kind: 'background', label: 'Undervault', path: 'bg/vault.png', tags: ['indoor'], packId: 'pack-harbour' },
    { id: 'asset-bg-gantry', kind: 'background', label: 'Sky Gantry', path: 'bg/gantry.png', tags: ['outdoor'], packId: 'pack-harbour' },
    { id: 'asset-bg-hills', kind: 'background', label: 'Far Hills parallax', path: 'bg/hills.png', tags: ['parallax'], packId: 'pack-harbour' },
    { id: 'asset-bg-fence', kind: 'background', label: 'Near Fence parallax', path: 'bg/fence.png', tags: ['parallax'], packId: 'pack-harbour' },
    { id: 'asset-bg-dust', kind: 'background', label: 'Vault Dust parallax', path: 'bg/dust.png', tags: ['parallax'], packId: 'pack-harbour' },
    { id: 'asset-bg-cloud', kind: 'background', label: 'Cloud parallax', path: 'bg/cloud.png', tags: ['parallax'], packId: 'pack-harbour' },
    { id: 'asset-bg-skyline', kind: 'background', label: 'Harbour skyline', path: 'bg/skyline.png', tags: ['skyline'], packId: 'pack-harbour' },
    { id: 'asset-bg-vault-ceiling', kind: 'background', label: 'Vault ceiling', path: 'bg/vault-ceiling.png', tags: ['skyline'], packId: 'pack-harbour' },

    { id: 'asset-portrait-hale', kind: 'portrait', label: 'Quartermaster Hale', path: 'portraits/hale.png', tags: ['npc'], packId: 'pack-harbour' },
    { id: 'asset-sprite-hale', kind: 'sprite', label: 'Hale sprite', path: 'sprites/hale.png', tags: ['npc'], packId: 'pack-harbour' },
    { id: 'asset-portrait-drowned', kind: 'portrait', label: 'The Drowned', path: 'portraits/drowned.png', tags: ['enemy'], packId: 'pack-harbour' },
    { id: 'asset-sprite-drowned', kind: 'sprite', label: 'Drowned sprite', path: 'sprites/drowned.png', tags: ['enemy'], packId: 'pack-harbour' },
    { id: 'asset-portrait-vess', kind: 'portrait', label: 'Runner Vess', path: 'portraits/vess.png', tags: ['companion'], packId: 'pack-harbour' },
    { id: 'asset-sprite-vess', kind: 'sprite', label: 'Vess sprite', path: 'sprites/vess.png', tags: ['companion'], packId: 'pack-harbour' },

    { id: 'asset-icon-rope', kind: 'icon', label: 'Rope icon', path: 'icons/rope.png', tags: ['item'], packId: 'pack-harbour' },
    { id: 'asset-icon-lantern', kind: 'icon', label: 'Lantern icon', path: 'icons/lantern.png', tags: ['item'], packId: 'pack-harbour' },
    { id: 'asset-icon-ration', kind: 'icon', label: 'Ration icon', path: 'icons/ration.png', tags: ['item'], packId: 'pack-harbour' },
    { id: 'asset-icon-stone', kind: 'icon', label: 'Tide Stone icon', path: 'icons/stone.png', tags: ['landmark'], packId: 'pack-harbour' },
    { id: 'asset-icon-seal', kind: 'icon', label: 'Guild Seal icon', path: 'icons/seal.png', tags: ['landmark'], packId: 'pack-harbour' },

    { id: 'asset-tileset-stone', kind: 'tileset', label: 'Wet Stone tiles', path: 'tiles/stone.png', tags: ['tileset'], packId: 'pack-harbour' },
    { id: 'asset-tileset-iron', kind: 'tileset', label: 'Gantry Iron tiles', path: 'tiles/iron.png', tags: ['tileset'], packId: 'pack-harbour' },
  ],

  assetPacks: [
    {
      id: 'pack-harbour',
      label: 'Harbourside Pack',
      version: '1.0.0',
      description: 'Backgrounds, portraits, and icons for the coverage world.',
      tags: ['harbour', 'audit'],
      theme: 'dark-fantasy',
      source: 'ai-generated',
      license: 'CC-BY-4.0',
      author: 'mcp-tool-shop',
      compatibility: { minSchemaVersion: '4.0.0', engineVersion: '2.0.0' },
    },
  ],

  // ── Loot tables (v4.3) ────────────────────────────────────────
  lootTables: [
    {
      id: 'loot-vault-silt',
      rolls: 2,
      entries: [
        {
          itemId: 'item-lantern',
          weight: 3,
          quantity: { min: 1, max: 1 },
          condition: 'random:0.25',
          rarity: 'uncommon',
        },
        {
          itemId: 'item-rope',
          weight: 7,
          quantity: { min: 1, max: 2 },
          condition: 'never',
          rarity: 'common',
        },
        {
          itemId: 'item-rope',
          weight: 1,
          quantity: { min: 1, max: 1 },
          condition: 'faction:tidewardens:>50',
          rarity: 'rare',
        },
      ],
      tags: ['vault', 'silt'],
    },
  ],

  // ── Transitions (v4.3) ────────────────────────────────────────
  transitions: [
    {
      id: 'trans-cargo-lift',
      zoneId: 'zone-under-vault',
      targetZoneId: 'zone-sky-gantry',
      type: 'cargo-lift',
      gridX: 12,
      gridY: 18,
      label: 'Undervault → Gantry Lift',
      animation: 'lift-rise',
      durationSeconds: 6,
      tags: ['vertical', 'slow'],
    },
  ],
};
