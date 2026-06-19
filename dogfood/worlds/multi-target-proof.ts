/**
 * multi-target-proof.ts — Canonical proof world for multi-target export validation.
 *
 * This is a complete, valid WorldProject with:
 * - 5 connected zones (tavern, market, cellar, alley, gate)
 * - 2 districts
 * - 4 entities (merchant, thief, guard, beast)
 * - 3 items (weapon, key, consumable)
 * - 1 loot table
 * - 2 spawn points
 * - 1 full dialogue tree
 * - 1 transition (stairwell)
 * - 2 asset bindings (background + sprite)
 * - Faction presence + pressure hotspot
 *
 * Used as the single source of truth for the three-lane export proof:
 *   AI RPG → ContentPack + re-import + semantic diff
 *   Godot  → .tscn + resource files + structure validation
 *   Unreal → cm conversion + Y-axis + ID preservation
 */

import type { WorldProject } from '../../packages/schema/src/index.js';

export const proofProject: WorldProject = {
    id: 'proof-dustwalk',
    name: 'Dustwalk — Multi-Target Proof',
    description: 'A frontier trading post on the edge of the wastes. Five zones, four factions, one loot table.',
    version: '1.0.0',
    genre: 'fantasy',
    tones: ['gritty', 'atmospheric'],
    difficulty: 'beginner',
    narratorTone: 'terse frontier voice, dry humor',
    author: 'mcp-tool-shop',
    license: 'MIT',
    mode: 'dungeon',

    map: {
        id: 'dustwalk-map',
        name: 'Dustwalk Town',
        description: 'A frontier trading post on the edge of the wastes.',
        gridWidth: 16,
        gridHeight: 12,
        tileSize: 32,
    },

    zones: [
        {
            id: 'zone-tavern',
            name: 'The Rusty Tankard',
            description: 'A weathered tavern at the crossroads. Firelight flickers through cracked shutters.',
            tags: ['safe', 'social', 'indoor'],
            gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 3,
            neighbors: ['zone-market', 'zone-cellar'],
            exits: [
                { targetZoneId: 'zone-market', label: 'East door to market' },
                { targetZoneId: 'zone-cellar', label: 'Trapdoor to cellar' },
            ],
            light: 7, noise: 4,
            hazards: [],
            interactables: [
                { name: 'bar-counter', type: 'use' },
                { name: 'bounty-board', type: 'inspect' },
            ],
            parentDistrictId: 'dist-town',
            backgroundId: 'asset-tavern-bg',
            stratumId: 'surface',
        },
        {
            id: 'zone-market',
            name: 'Dustwalk Market',
            description: 'Open-air bazaar under patched awnings. Vendors hawk wares from rickety stalls.',
            tags: ['trade', 'outdoor', 'busy'],
            gridX: 5, gridY: 0, gridWidth: 5, gridHeight: 4,
            neighbors: ['zone-tavern', 'zone-alley', 'zone-gate'],
            exits: [
                { targetZoneId: 'zone-tavern', label: 'West to tavern' },
                { targetZoneId: 'zone-alley', label: 'Narrow passage east' },
                { targetZoneId: 'zone-gate', label: 'South road to gate' },
            ],
            light: 9, noise: 7,
            hazards: [],
            interactables: [
                { name: 'fruit-stall', type: 'use' },
                { name: 'notice-board', type: 'inspect' },
            ],
            parentDistrictId: 'dist-town',
        },
        {
            id: 'zone-cellar',
            name: 'Tavern Cellar',
            description: 'Damp stone passage beneath the tavern. Rats skitter in the dark.',
            tags: ['dungeon', 'dark', 'underground'],
            gridX: 0, gridY: 4, gridWidth: 3, gridHeight: 3,
            neighbors: ['zone-tavern'],
            exits: [{ targetZoneId: 'zone-tavern', label: 'Ladder up to tavern' }],
            light: 2, noise: 1,
            hazards: ['crumbling-floor'],
            interactables: [
                { name: 'wine-barrel', type: 'inspect' },
                { name: 'rusty-grate', type: 'use' },
            ],
            parentDistrictId: 'dist-under',
            elevation: -3,
            elevationRange: { floor: -5, ceiling: -1 },
            stratumId: 'underground',
        },
        {
            id: 'zone-alley',
            name: "Beggar's Alley",
            description: 'Narrow passage between leaning buildings. Shadows pool in doorways.',
            tags: ['dangerous', 'cramped', 'outdoor'],
            gridX: 11, gridY: 2, gridWidth: 2, gridHeight: 4,
            neighbors: ['zone-market'],
            exits: [{ targetZoneId: 'zone-market', label: 'West to market' }],
            light: 3, noise: 2,
            hazards: ['pickpockets'],
            interactables: [
                { name: 'loose-brick', type: 'inspect', description: 'Something is hidden behind it.' },
            ],
            parentDistrictId: 'dist-under',
        },
        {
            id: 'zone-gate',
            name: 'South Gate',
            description: 'Fortified gate leading to the wilderness beyond. Guards check papers.',
            tags: ['transition', 'guarded', 'outdoor'],
            gridX: 5, gridY: 7, gridWidth: 5, gridHeight: 3,
            neighbors: ['zone-market'],
            exits: [{ targetZoneId: 'zone-market', label: 'North to market' }],
            light: 8, noise: 5,
            hazards: [],
            interactables: [
                { name: 'gate-lever', type: 'use' },
                { name: 'wanted-poster', type: 'inspect' },
            ],
            parentDistrictId: 'dist-town',
        },
    ],

    connections: [
        { fromZoneId: 'zone-tavern', toZoneId: 'zone-market', kind: 'door', bidirectional: true },
        { fromZoneId: 'zone-tavern', toZoneId: 'zone-cellar', kind: 'stairs', bidirectional: true },
        { fromZoneId: 'zone-market', toZoneId: 'zone-alley', kind: 'trail', bidirectional: true },
        { fromZoneId: 'zone-market', toZoneId: 'zone-gate', kind: 'road', bidirectional: true },
    ],

    districts: [
        {
            id: 'dist-town',
            name: 'Dustwalk Town',
            zoneIds: ['zone-tavern', 'zone-market', 'zone-gate'],
            tags: ['civilized', 'trade'],
            controllingFaction: 'faction-merchants',
            baseMetrics: { commerce: 70, morale: 50, safety: 60, stability: 55 },
            economyProfile: { supplyCategories: ['provisions', 'arms', 'tools'], scarcityDefaults: {} },
        },
        {
            id: 'dist-under',
            name: 'The Underbelly',
            zoneIds: ['zone-cellar', 'zone-alley'],
            tags: ['criminal', 'hidden'],
            controllingFaction: 'faction-thieves',
            baseMetrics: { commerce: 20, morale: 30, safety: 15, stability: 25 },
            economyProfile: { supplyCategories: ['contraband', 'poisons'], scarcityDefaults: {} },
        },
    ],

    landmarks: [
        {
            id: 'lm-bounty-board',
            name: 'Bounty Board',
            zoneId: 'zone-tavern',
            gridX: 2, gridY: 1,
            tags: ['quest', 'interact'],
            description: 'Worn parchments pinned under rusted nails.',
            interactionType: 'inspect',
        },
    ],

    factionPresences: [
        { factionId: 'faction-merchants', districtIds: ['dist-town'], influence: 65, alertLevel: 10 },
        { factionId: 'faction-thieves', districtIds: ['dist-under'], influence: 80, alertLevel: 30 },
    ],

    pressureHotspots: [
        {
            id: 'ph-alley-ambush',
            zoneId: 'zone-alley',
            pressureType: 'ambush',
            baseProbability: 0.6,
            tags: ['combat', 'stealth'],
        },
    ],

    dialogues: [
        {
            id: 'dlg-mara',
            speakers: ['npc-mara'],
            entryNodeId: 'greeting',
            nodes: {
                greeting: {
                    id: 'greeting',
                    speaker: 'Mara Greystone',
                    text: 'Welcome, traveler. What can I get you?',
                    choices: [
                        { id: 'ch-supplies', text: 'I need supplies.', nextNodeId: 'shop' },
                        { id: 'ch-rumors', text: 'Heard any rumors?', nextNodeId: 'rumors' },
                        { id: 'ch-leave', text: 'Nothing, thanks.', nextNodeId: 'farewell' },
                    ],
                },
                shop: {
                    id: 'shop',
                    speaker: 'Mara Greystone',
                    text: 'Take a look at my wares. Best prices this side of the wastes.',
                },
                rumors: {
                    id: 'rumors',
                    speaker: 'Mara Greystone',
                    text: 'The cellar has been overrun with rats. Captain Holt posted a bounty.',
                    choices: [
                        {
                            id: 'ch-accept',
                            text: "I'll check it out.",
                            nextNodeId: 'quest-accept',
                            effects: [{ type: 'set-global', params: { key: 'quest_rats', value: 'accepted' } }],
                        },
                        { id: 'ch-decline', text: 'Not interested.', nextNodeId: 'farewell' },
                    ],
                },
                'quest-accept': {
                    id: 'quest-accept',
                    speaker: 'Mara Greystone',
                    text: 'Good luck. The key to the cellar hatch is behind the bar.',
                    effects: [{ type: 'set-global', params: { key: 'cellar_key', value: 'true' } }],
                },
                farewell: {
                    id: 'farewell',
                    speaker: 'Mara Greystone',
                    text: 'Safe travels, stranger.',
                },
            },
        },
    ],

    entityPlacements: [
        {
            entityId: 'npc-mara',
            name: 'Mara Greystone',
            zoneId: 'zone-tavern',
            role: 'merchant',
            gridX: 1, gridY: 1,
            dialogueId: 'dlg-mara',
            stats: { vigor: 2, instinct: 3, will: 5 },
            resources: { hp: 20, gold: 200 },
            tags: ['friendly', 'quest-giver'],
            ai: { profileId: 'stationary', goals: ['serve-customers'] },
            spriteId: 'asset-mara-sprite',
        },
        {
            entityId: 'npc-thief',
            name: 'Kael Shadowstep',
            zoneId: 'zone-alley',
            role: 'enemy',
            gridX: 12, gridY: 4,
            stats: { vigor: 5, instinct: 8, will: 3 },
            resources: { hp: 25, gold: 15 },
            tags: ['hostile', 'stealth'],
            ai: { profileId: 'patrol', goals: ['steal', 'flee'], fears: ['guards'] },
            factionId: 'faction-thieves',
            spawnCondition: 'time:night',
        },
        {
            entityId: 'npc-holt',
            name: 'Captain Holt',
            zoneId: 'zone-gate',
            role: 'npc',
            gridX: 7, gridY: 8,
            stats: { vigor: 7, instinct: 5, will: 6 },
            resources: { hp: 50 },
            tags: ['guard', 'quest-giver'],
            ai: { profileId: 'stationary', goals: ['guard-gate'] },
            factionId: 'faction-merchants',
        },
        {
            entityId: 'mob-rat',
            name: 'Giant Cellar Rat',
            zoneId: 'zone-cellar',
            role: 'enemy',
            gridX: 1, gridY: 5,
            stats: { vigor: 2, instinct: 6, will: 1 },
            resources: { hp: 10 },
            tags: ['beast', 'weak'],
            ai: { profileId: 'wander', goals: ['scavenge'], fears: ['fire'] },
            spawnCondition: 'random:0.7',
        },
    ],

    itemPlacements: [
        {
            itemId: 'item-rusty-dagger',
            name: 'Rusty Dagger',
            description: 'A pitted blade found near a collapsed crate.',
            zoneId: 'zone-cellar',
            gridX: 2, gridY: 5,
            hidden: false,
            slot: 'weapon',
            rarity: 'common',
            statModifiers: { vigor: 1 },
            grantedTags: ['armed'],
            grantedVerbs: ['stab'],
        },
        {
            itemId: 'item-gate-key',
            name: 'South Gate Key',
            description: 'An iron key marked with the town seal.',
            zoneId: 'zone-alley',
            gridX: 11, gridY: 3,
            hidden: true,
            container: 'loose-brick',
            slot: 'tool',
            rarity: 'uncommon',
            grantedVerbs: ['unlock-gate'],
        },
        {
            itemId: 'item-health-potion',
            name: 'Health Potion',
            description: 'A murky red liquid in a stoppered vial.',
            zoneId: 'zone-tavern',
            gridX: 3, gridY: 1,
            hidden: false,
            slot: 'consumable',
            rarity: 'common',
            resourceModifiers: { hp: 10 },
        },
    ],

    lootTables: [
        {
            id: 'loot-rat',
            rolls: 1,
            entries: [
                { itemId: 'item-rusty-dagger', weight: 2 },
                { itemId: 'item-health-potion', weight: 5 },
            ],
            tags: ['beast-drops'],
        },
    ],

    encounterAnchors: [
        {
            id: 'enc-cellar-rats',
            zoneId: 'zone-cellar',
            encounterType: 'combat',
            enemyIds: ['mob-rat'],
            probability: 0.8,
            cooldownTurns: 3,
            tags: ['beast', 'easy'],
        },
    ],

    spawnPoints: [
        { id: 'spawn-tavern', zoneId: 'zone-tavern', gridX: 2, gridY: 2, isDefault: true },
        { id: 'spawn-gate', zoneId: 'zone-gate', gridX: 7, gridY: 9, isDefault: false },
    ],

    transitions: [
        {
            id: 'trans-cellar-stairs',
            zoneId: 'zone-tavern',
            targetZoneId: 'zone-cellar',
            type: 'stairwell',
            gridX: 0, gridY: 2,
            label: 'Cellar Stairs',
            animation: 'descend',
            durationSeconds: 1.5,
            tags: ['vertical'],
        },
    ],

    progressionTrees: [],
    // Wave B-3 (town economy): a market in the bazaar + a smith in the tavern.
    craftingStations: [
        { id: 'craft-smith', zoneId: 'zone-tavern', stationType: 'forge', availableRecipes: ['iron-blade', 'horseshoe'] },
    ],
    marketNodes: [
        { id: 'market-bazaar', zoneId: 'zone-market', merchantEntityId: 'npc-merchant', supplyCategories: ['food', 'tools'], priceModifier: 1.2, contrabandAvailable: false },
    ],
    // Town structures: an enterable inn (footprint → StaticBody2D + interior link),
    // a market-square hub serving nearby zones, a fortified keep at the gate.
    buildings: [
        { id: 'bld-inn', name: 'The Roadside Inn', buildingType: 'tavern', gridX: 5, gridY: 5, width: 3, height: 2, zoneId: 'zone-market', interiorZoneId: 'zone-cellar', tags: ['lodging'] },
    ],
    hubs: [
        { id: 'hub-square', name: 'Market Square', zoneId: 'zone-market', hubType: 'market-square', serviceTypes: ['market', 'inn'], connectedZoneIds: ['zone-tavern', 'zone-alley'], tags: [] },
    ],
    strongholds: [
        { id: 'hold-keep', name: 'Dustwall Keep', zoneId: 'zone-gate', factionId: 'faction-garrison', defenseLevel: 3, garrisonEntityIds: ['npc-merchant'], tags: [] },
    ],
    // World modeling: two vertical strata (surface town over its cellar) + a
    // stairwell link. zone-tavern sits on 'surface' (order 0), zone-cellar on
    // 'underground' (order -1) — so the cellar z-bands below the town.
    strata: [
        { id: 'surface', name: 'Surface', order: 0, zRange: { floor: 0, ceiling: 12 }, visibleStrata: ['underground'], tags: [] },
        { id: 'underground', name: 'Underground', order: -1, zRange: { floor: -5, ceiling: 0 }, tags: [] },
    ],
    stratumLinks: [
        { id: 'slink-trapdoor', fromStratumId: 'surface', toStratumId: 'underground', fromZoneId: 'zone-tavern', toZoneId: 'zone-cellar', bidirectional: true, linkType: 'stairs' },
    ],
    // Wave B-2: a color tileset (no imagePath) + a ground layer over the tavern.
    // Color-only so the Godot smoke loads with zero external texture deps.
    tilesets: [
        {
            id: 'ts-dustwalk',
            name: 'Dustwalk Tiles',
            tileWidth: 32,
            tileHeight: 32,
            tiles: [
                { id: 'dw-floor', tilesetId: 'ts-dustwalk', row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
                { id: 'dw-wall', tilesetId: 'ts-dustwalk', row: 0, col: 1, tags: ['wall'], walkable: false, opacity: 1 },
            ],
        },
    ],
    tileLayers: [
        {
            id: 'tl-ground',
            name: 'Ground',
            zIndex: 0,
            tiles: [
                // Tavern floor (rows y=1,2 across x=0..3) + a north wall (y=0).
                { tileId: 'dw-wall', gridX: 0, gridY: 0 },
                { tileId: 'dw-wall', gridX: 1, gridY: 0 },
                { tileId: 'dw-floor', gridX: 0, gridY: 1 },
                { tileId: 'dw-floor', gridX: 1, gridY: 1 },
                { tileId: 'dw-floor', gridX: 2, gridY: 1 },
                { tileId: 'dw-floor', gridX: 3, gridY: 1 },
                { tileId: 'dw-floor', gridX: 0, gridY: 2 },
                { tileId: 'dw-floor', gridX: 1, gridY: 2 },
                { tileId: 'dw-floor', gridX: 2, gridY: 2 },
                { tileId: 'dw-floor', gridX: 3, gridY: 2 },
            ],
        },
    ],
    // Wave B-3 (interiors): a couple of props placed in the tavern.
    props: [
        { id: 'prop-barrel', name: 'Barrel', width: 1, height: 1, tags: ['container'], walkable: false, interactable: true },
        { id: 'prop-rug', name: 'Rug', width: 2, height: 1, tags: ['decor'], walkable: true, interactable: false },
    ],
    propPlacements: [
        { id: 'pp-barrel-1', propId: 'prop-barrel', gridX: 1, gridY: 1, zoneId: 'zone-tavern' },
        { id: 'pp-rug-1', propId: 'prop-rug', gridX: 2, gridY: 2, zoneId: 'zone-tavern' },
    ],
    ambientLayers: [
        {
            id: 'amb-cellar-drip',
            name: 'Cellar Drip',
            zoneIds: ['zone-cellar'],
            type: 'fog',
            intensity: 0.5,
            color: '#1a1a2e',
        },
    ],
    assets: [
        {
            id: 'asset-tavern-bg',
            kind: 'background',
            label: 'Tavern Interior Background',
            path: 'assets/backgrounds/tavern-interior.png',
            tags: ['indoor', 'warm'],
        },
        {
            id: 'asset-mara-sprite',
            kind: 'sprite',
            label: 'Mara Greystone Sprite',
            path: 'assets/sprites/mara-greystone.png',
            tags: ['npc', 'merchant'],
        },
    ],
    assetPacks: [],
};
