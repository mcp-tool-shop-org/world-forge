/**
 * salt-road.ts — Salt Road: the Long Quay. The reference diorama's world.
 *
 * A working harbour where salt is weighed, taxed, and occasionally not paid for.
 * Six zones a person can walk, one door that will not open, one stretch of stone
 * that has put every factor in Saltgate on their back at least once, and a quay
 * whose fortunes can turn inside an afternoon.
 *
 * ── WHY THIS FILE EXISTS, AND WHAT WAS WRONG BEFORE ──────────────────────────
 *
 * C3's record said a starter world had been re-authored in the Forge. It had not.
 * The only fixture in the export lane was `vocabulary-coverage.ts` — an audit
 * instrument that populates every field once so a differ can classify it, and
 * nothing anyone would call a place. This is the first world authored in the Forge
 * schema to be PLAYED rather than measured.
 *
 * ── THE PROSE LAW, WHICH IS BINDING HERE ─────────────────────────────────────
 *
 * Director, 2026-07-29: "let's make the game more human and less like they were
 * written by an engineer." The starter packs were authored backwards from systems —
 * starter-merchant literally so — and it shows in the content surface: descriptions
 * that enumerate a zone's mechanical affordances, one NPC per mechanic, names that
 * are their own function.
 *
 * So every player-facing string in this file was written as prose first and wired
 * to the system second. The rules it was written under:
 *
 *   * A SPEAKER AND A MOTIVE. Nobody refuses the player on behalf of a rule. The
 *     clerk at the warehouse door has her name on the register and a mother in
 *     Dockward, and that is why the door stays shut.
 *   * NO SYSTEM NOUNS. No ids, no "zone", no "requires", no effect names. If a
 *     mechanic is present the prose shows its consequence, not its label.
 *   * NO SYMMETRY FOR COVERAGE'S SAKE. There is no NPC per mechanic and no
 *     interactable per verb. Two zones have nothing to talk to.
 *   * THE OATMEAL CHECK (Compton: combinatorial uniqueness still reads as
 *     oatmeal). Every description carries ONE hand-placed specific a reader could
 *     remember afterwards — the wax thumbprint on the third scale, the cage with a
 *     lock and an open door, the shed kept deliberately too warm. Perceptual, not
 *     structural: it is not enough that the strings differ.
 *
 * The mechanics are unchanged by any of it. Salt is still weighed, the gate still
 * refuses, the stone is still slick. It just stops SOUNDING like the proof.
 *
 * ── WHAT THE DIORAMA NEEDS FROM THIS WORLD ───────────────────────────────────
 *
 *   movement    six connected zones, walkable in both directions
 *   spawns      an encounter anchor on the Crooked Stair, at an authored rate
 *   a refusal   the Bonded Warehouse, gated hard, with a person's reason
 *   a re-dress  Dockward's economy is authored fragile so a shock moves the
 *               quay's condition and flips its dressing on a fixed layout
 *
 * ── AUTHORED KEYS THAT DRIVE THE CLIENT ──────────────────────────────────────
 *
 * The scene descriptor is built from keys this schema already carries
 * (`export-ai-rpg/convert-zones.ts:buildScene`), so nothing here is invented for
 * the renderer:
 *
 *   biome            the first `biome:`-prefixed tag
 *   timeOfDay        `Zone.timeOfDay`
 *   dressingDensity  bucketed from the interactable count (0 sparse, 1-2 normal, 3+ dense)
 *
 * `variantTags` are NOT authored — the sim derives them from a zone's condition
 * (`dressing:damaged`, `props:rubble`, …). Authoring them would let a renderer
 * read a layout out of the simulation, which is the one thing the descriptor
 * vocabulary exists to prevent.
 */

import type { WorldProject } from '../../packages/schema/src/index.js';

export const saltRoadProject: WorldProject = {
    id: 'salt-road-long-quay',
    name: 'Salt Road: The Long Quay',
    description:
        'Salt comes in by sea and leaves by road, and every ounce of it is weighed twice, taxed once, '
        + 'and argued over for a week. A factor with a good name can live well here. A factor with a '
        + 'late caravan can stop being a factor by Friday.',
    version: '1.0.0',

    genre: 'mercantile',
    // A closed key set (dark, gritty, heroic, noir, comedic, eerie, tense,
    // atmospheric) — not prose. The first draft authored 'dry', 'close' and
    // 'transactional'; all three were skipped and the lane fell back to
    // 'atmospheric', losing the intent entirely. The voice those words were reaching
    // for belongs in narratorTone, which is free text.
    tones: ['gritty', 'tense'],
    difficulty: 'intermediate',
    narratorTone:
        'A ledger-keeper who has seen this before and is not going to be dramatic about it.',
    mode: 'district',

    author: 'mcp-tool-shop',
    license: 'MIT',
    category: 'mercantile',
    projectTags: ['salt-road', 'diorama', 'harbour'],

    map: {
        id: 'salt-road-map',
        name: 'The Long Quay',
        description:
            'The harbour end of the Salt Road, from the counting houses down to the water and one '
            + 'stair nobody puts on a map.',
        gridWidth: 40,
        gridHeight: 28,
        tileSize: 32,
    },

    // ── Zones ────────────────────────────────────────────────────────────────
    zones: [
        {
            id: 'counting-house',
            name: 'The Counting House',
            description:
                'Your standing desk, your ledger, and a wax jack burned down to a stub because you '
                + 'keep meaning to trim it and keep not doing it. The window faces the water, which '
                + 'was the entire reason for the rent. On a bad morning you can stand here and watch '
                + 'your own cargo fail to arrive.',
            tags: ['interior', 'safe', 'home', 'lawful', 'biome:counting-house'],
            gridX: 2,
            gridY: 4,
            gridWidth: 6,
            gridHeight: 5,
            neighbors: ['weighing-floor'],
            exits: [{ targetZoneId: 'weighing-floor', label: 'the door to the floor' }],
            light: 4,
            noise: 1,
            hazards: [],
            interactables: [
                {
                    name: 'the house ledger',
                    type: 'inspect',
                    description:
                        'Two hands in it. Yours, and whoever kept the books before the house was '
                        + 'yours — theirs slope backwards and they never crossed a seven.',
                },
                {
                    name: 'the wax jack',
                    type: 'use',
                    description: 'A stub, a bent wick, and enough left to seal three letters if none of them are long.',
                },
            ],
            parentDistrictId: 'saltgate',
            elevation: 0,
            timeOfDay: 'morning',
            collisionType: 'walkable',
        },
        {
            id: 'weighing-floor',
            name: 'The Weighing Floor',
            description:
                'Six brass scales and only the third one is trusted. Corvane presses his thumb into '
                + 'a bead of wax on its beam at close of day, so anyone who re-tares it overnight has '
                + 'to explain a broken thumbprint in the morning. The queue forms before the doors '
                + 'open. Everyone in it is carrying salt and a grievance about salt.',
            tags: ['interior', 'market', 'lawful', 'crowded', 'biome:harbour-stone'],
            gridX: 10,
            gridY: 4,
            gridWidth: 8,
            gridHeight: 6,
            neighbors: ['counting-house', 'bonded-warehouse', 'long-quay'],
            exits: [
                { targetZoneId: 'counting-house', label: 'back to your own door' },
                { targetZoneId: 'bonded-warehouse', label: 'the sealed doors' },
                { targetZoneId: 'long-quay', label: 'out to the water' },
            ],
            light: 5,
            noise: 6,
            hazards: [],
            interactables: [
                {
                    name: 'the third scale',
                    type: 'inspect',
                    description: 'The wax bead is intact today. The beam sits level and everyone here knows it.',
                },
                {
                    name: 'the posted rates',
                    type: 'inspect',
                    description:
                        'Chalked fresh each morning. Someone has rubbed out the coarse-grade figure '
                        + 'and written it again lower, and not neatly.',
                },
                {
                    name: 'the queue',
                    type: 'talk',
                    description: 'Nobody wants to lose their place badly enough to be interesting.',
                },
            ],
            parentDistrictId: 'saltgate',
            tilesetId: 'tileset-harbour-stone',
            elevation: 0,
            timeOfDay: 'morning',
            collisionType: 'walkable',
        },
        {
            id: 'bonded-warehouse',
            name: 'The Bonded Warehouse',
            description:
                'Everything in here belongs to somebody who is not here. Crates under seal stacked to '
                + 'the beams, and at the back a cage for goods nobody came for — the cage has a heavy '
                + 'lock and the door is left standing open, which tells you exactly what the Guild '
                + 'thinks of anyone who would try it. The air is dry enough to hurt your throat. Salt '
                + 'only keeps if it stays that way.',
            tags: ['interior', 'storage', 'lawful', 'guarded', 'biome:bonded-store'],
            gridX: 20,
            gridY: 3,
            gridWidth: 7,
            gridHeight: 6,
            neighbors: ['weighing-floor'],
            exits: [{ targetZoneId: 'weighing-floor', label: 'back out to the floor' }],
            light: 2,
            noise: 2,
            hazards: [],
            interactables: [
                {
                    name: 'the open cage',
                    type: 'inspect',
                    description:
                        'Six months of unclaimed goods and a lock hanging off the hasp. Halle keeps '
                        + 'the key on the register nail where anyone can see it.',
                },
            ],
            parentDistrictId: 'saltgate',
            elevation: 0,
            timeOfDay: 'morning',
            collisionType: 'walkable',
            // The door that will not open. Hard, and refused by a person with her own
            // reasons — never by a rule citing itself.
            entryGate: {
                conditions: ['item:guild-seal'],
                mode: 'hard',
                reason:
                    'Halle keeps her hand flat on the register. "It\'s my name beside whatever leaves '
                    + 'here, and I\'ve a mother in Dockward. Seal, or nothing."',
            },
        },
        {
            id: 'long-quay',
            name: 'The Long Quay',
            description:
                'Long enough that the far end keeps its own weather. Hawsers coiled chest-high, a '
                + 'crane that screams on the upstroke, and a tally-boy who has learned to deliver bad '
                + 'news from just outside arm\'s reach. Where the tide gets over the lip the stone '
                + 'stays wet, and it does not look wet.',
            tags: ['exterior', 'harbour', 'busy', 'biome:harbour-stone'],
            gridX: 10,
            gridY: 13,
            gridWidth: 14,
            gridHeight: 6,
            neighbors: ['weighing-floor', 'customs-shed', 'crooked-stair'],
            exits: [
                { targetZoneId: 'weighing-floor', label: 'in off the water' },
                { targetZoneId: 'customs-shed', label: 'the shed with the stamp' },
                { targetZoneId: 'crooked-stair', label: 'the stair at the end' },
            ],
            light: 7,
            noise: 8,
            hazards: ['wet stone'],
            hazardRefs: ['tide-slick'],
            interactables: [
                {
                    name: 'the tally-boy',
                    type: 'talk',
                    description:
                        'He has the manifest and he has already read it, which is why he is standing '
                        + 'where he is standing.',
                },
                {
                    name: 'the coiled hawsers',
                    type: 'inspect',
                    description: 'Salt-stiff. The outer turns have gone the colour of old bone.',
                },
                {
                    name: 'the berth at the far end',
                    type: 'inspect',
                    description: 'Empty nine days now. The bollard still has last month\'s chafe marks on it.',
                },
            ],
            parentDistrictId: 'dockward',
            tilesetId: 'tileset-harbour-stone',
            elevation: 0,
            timeOfDay: 'morning',
            collisionType: 'walkable',
        },
        {
            id: 'customs-shed',
            name: 'The Customs Shed',
            description:
                'Three clerks, four desks, and a stamp that decides whether a thing exists. The '
                + 'unopened manifests are stacked by date and the one at the bottom is from a spring '
                + 'nobody in here will discuss. It is warmer than it needs to be, and that is '
                + 'deliberate: a man sweating signs faster.',
            tags: ['interior', 'authority', 'slow', 'biome:customs'],
            gridX: 26,
            gridY: 14,
            gridWidth: 7,
            gridHeight: 5,
            neighbors: ['long-quay'],
            exits: [{ targetZoneId: 'long-quay', label: 'back out into the air' }],
            light: 3,
            noise: 3,
            hazards: [],
            interactables: [
                {
                    name: 'the stamp',
                    type: 'inspect',
                    description:
                        'Worn smooth on one edge from being set down hard. Drell is the only one who '
                        + 'may lift it and he does not hurry.',
                },
                {
                    name: 'the stacked manifests',
                    type: 'inspect',
                    description: 'Dated, dusty, and in no danger of being opened this week.',
                },
            ],
            parentDistrictId: 'dockward',
            elevation: 0,
            timeOfDay: 'morning',
            collisionType: 'walkable',
        },
        {
            id: 'crooked-stair',
            name: 'The Crooked Stair',
            description:
                'Twenty-two steps down and not one of them the same height as the last. There is a '
                + 'doorway at the bottom with no sign over it and chalk marks beside it in a code '
                + 'that changes whenever somebody gets careless. Nobody sweeps here. The steps are '
                + 'worn smooth up the middle anyway, so somebody uses them constantly.',
            tags: ['exterior', 'unbonded', 'contested', 'biome:warren-brick'],
            gridX: 4,
            gridY: 20,
            gridWidth: 6,
            gridHeight: 6,
            neighbors: ['long-quay'],
            exits: [{ targetZoneId: 'long-quay', label: 'back up to the quay' }],
            light: 2,
            noise: 2,
            hazards: [],
            interactables: [],
            parentDistrictId: 'the-warrens',
            elevation: -4,
            timeOfDay: 'morning',
            collisionType: 'walkable',
        },
    ],

    connections: [
        { fromZoneId: 'counting-house', toZoneId: 'weighing-floor', kind: 'door', bidirectional: true },
        { fromZoneId: 'weighing-floor', toZoneId: 'bonded-warehouse', kind: 'door', bidirectional: true },
        { fromZoneId: 'weighing-floor', toZoneId: 'long-quay', kind: 'passage', bidirectional: true },
        { fromZoneId: 'long-quay', toZoneId: 'customs-shed', kind: 'door', bidirectional: true },
        { fromZoneId: 'long-quay', toZoneId: 'crooked-stair', kind: 'stairs', bidirectional: true },
    ],

    // ── Districts ────────────────────────────────────────────────────────────
    //
    // The numbers here are the shock's fuel. Dockward is authored FRAGILE — its
    // stability and morale sit close enough to a threshold that one bad afternoon
    // moves the quay's condition, which is what makes the re-dress a real event
    // rather than a demo button. Saltgate is comfortable and stays comfortable, so
    // the diorama shows a town where one part turns and the rest does not.
    districts: [
        {
            id: 'saltgate',
            name: 'Saltgate',
            zoneIds: ['counting-house', 'weighing-floor', 'bonded-warehouse'],
            tags: ['lawful', 'trade'],
            controllingFaction: 'assay-guild',
            baseMetrics: { commerce: 68, morale: 62, safety: 70, stability: 66 },
            economyProfile: {
                supplyCategories: ['salt', 'staples', 'tools'],
                scarcityDefaults: { salt: 20, staples: 35, tools: 45 },
            },
        },
        {
            id: 'dockward',
            name: 'Dockward',
            zoneIds: ['long-quay', 'customs-shed'],
            tags: ['harbour', 'tariff'],
            controllingFaction: 'harbour-authority',
            // Fragile on purpose. A quay is one hull and one tide away from a bad month.
            baseMetrics: { commerce: 54, morale: 41, safety: 44, stability: 38 },
            economyProfile: {
                supplyCategories: ['salt', 'staples', 'shipwright'],
                scarcityDefaults: { salt: 30, staples: 55, shipwright: 70 },
            },
        },
        {
            id: 'the-warrens',
            name: 'The Warrens',
            zoneIds: ['crooked-stair'],
            tags: ['unbonded', 'contested'],
            // Deliberately uncontrolled: no faction means no recourse down here, which
            // is the whole character of the place and not a gap in the authoring.
            baseMetrics: { commerce: 30, morale: 33, safety: 18, stability: 26 },
            economyProfile: {
                supplyCategories: ['salt', 'contraband'],
                scarcityDefaults: { salt: 45, contraband: 25 },
            },
        },
    ],

    landmarks: [
        {
            id: 'the-bead-of-wax',
            name: 'The Bead of Wax',
            zoneId: 'weighing-floor',
            gridX: 13,
            gridY: 6,
            tags: ['trust', 'inspect'],
            description:
                'A thumbprint pressed into wax on the beam of the third scale. It is the closest '
                + 'thing this harbour has to a promise.',
            interactionType: 'inspect',
        },
        {
            id: 'the-empty-berth',
            name: 'The Empty Berth',
            zoneId: 'long-quay',
            gridX: 22,
            gridY: 15,
            tags: ['debt', 'inspect'],
            description: 'Nine days empty. Every factor on the quay has done the arithmetic.',
            interactionType: 'inspect',
        },
    ],

    // ── Factions ─────────────────────────────────────────────────────────────
    //
    // ⚠ DECLARED DESPITE HAVING NO ENGINE CHANNEL, and the reason is worth stating so
    // a later reader does not "clean this up". C3 evaluated `factionPresences` and
    // ruled DO NOT MAP: of factionId/districtIds/influence/alertLevel/patrolRoutes,
    // only districtIds has an engine counterpart and it is already carried as
    // `districts[].controllingFaction`.
    //
    // But this is the FORGE's authoring surface, and the forge checks that an
    // entity's `factionId` is declared somewhere. Without these two records the
    // export tags Corvane, Halle and Drell `faction:UNKNOWN` — three people whose
    // whole behaviour is who they answer to. So they are authored for the reference
    // check and for the Godot lane, and the engine lane dropping the presence
    // RECORD while keeping the entity TAGS is the correct outcome, not a loss.
    factionPresences: [
        {
            factionId: 'assay-guild',
            districtIds: ['saltgate'],
            influence: 78,
            alertLevel: 12,
        },
        {
            factionId: 'harbour-authority',
            districtIds: ['dockward'],
            influence: 61,
            alertLevel: 34,
        },
    ],

    // Not authored, and the reason is recorded rather than left blank: C3 ruled a
    // hotspot's {zoneId, pressureType, baseProbability} would be a FOURTH parallel
    // spawn system beside encounter-spawn, the pressure system and typed hazards.
    pressureHotspots: [],

    dialogues: [],

    progressionTrees: [],

    // ── People ───────────────────────────────────────────────────────────────
    //
    // Five, not one per mechanic. Two of the six zones have nobody in them, because
    // a harbour has quiet corners and because symmetry for coverage's sake is the
    // tell the prose law names.
    entityPlacements: [
        {
            entityId: 'npc-corvane',
            name: 'Assay Master Corvane',
            zoneId: 'weighing-floor',
            gridX: 13,
            gridY: 7,
            role: 'merchant',
            factionId: 'assay-guild',
            tags: ['guild', 'assay'],
            spriteId: 'sprite-corvane',
            custom: {
                // Motive, not a job description. What he wants is why he behaves.
                wants: 'to retire without ever having signed a false weight',
                tell: 'checks the wax bead before he greets anyone',
            },
        },
        {
            entityId: 'npc-halle',
            name: 'Bonded Clerk Halle',
            zoneId: 'bonded-warehouse',
            gridX: 21,
            gridY: 5,
            role: 'npc',
            factionId: 'assay-guild',
            tags: ['bonded', 'register'],
            spriteId: 'sprite-halle',
            custom: {
                wants: 'to keep her name clean on a register she did not write the rules for',
                tell: 'answers without looking up from the book',
            },
        },
        {
            entityId: 'npc-drell',
            name: 'Harbourmaster Drell',
            zoneId: 'customs-shed',
            gridX: 28,
            gridY: 16,
            role: 'quest-giver',
            factionId: 'harbour-authority',
            tags: ['authority', 'tariff'],
            custom: {
                wants: 'the shed kept warm and the queue kept moving',
                tell: 'sets the stamp down harder than he needs to',
            },
        },
        {
            entityId: 'npc-tally-boy',
            name: 'The Tally-Boy',
            zoneId: 'long-quay',
            gridX: 20,
            gridY: 15,
            role: 'npc',
            tags: ['messenger'],
            custom: {
                wants: 'to deliver the manifest and be somewhere else',
                tell: 'stands one step further back than the news requires',
            },
        },
        {
            entityId: 'npc-stair-collector',
            name: 'A Collector on the Stair',
            zoneId: 'crooked-stair',
            gridX: 6,
            gridY: 23,
            role: 'enemy',
            // ⚠ MEASURED: `placements[].spawnCondition` has NO runtime channel — the
            // intake drops it as `needs-module-vocabulary`. A first draft authored
            // `never` here meaning "only the anchor puts this person on the stair";
            // that string is dropped, so the collector stands here permanently
            // whatever it says.
            //
            // The fiction absorbs it rather than fighting it, which is the honest
            // resolution: a contested stair always has somebody working it. The
            // anchor then adds MORE when your luck is out — measured firing on 17 of
            // 40 seeds against the authored 0.45, spawning fresh instances rather
            // than moving this one. So "somebody is always down there, and sometimes
            // he brought friends" is not a story told over a limitation; it is what
            // the mechanics actually do.
            tags: ['unbonded', 'collector'],
            stats: { vigor: 4, instinct: 5, will: 3 },
            resources: { hp: 14, stamina: 6 },
            ai: { profileId: 'aggressive', goals: ['name-and-a-number'], fears: ['the-watch'] },
            custom: {
                wants: 'a name and a number, and to be gone before the watch comes down',
                tell: 'redraws a chalk mark while you talk',
            },
        },
    ],

    itemPlacements: [
        {
            itemId: 'guild-seal',
            name: 'The Guild Seal',
            zoneId: 'counting-house',
            gridX: 4,
            gridY: 6,
            slot: 'tool',
            rarity: 'uncommon',
            // REQUIRED by the schema, and omitting it is what produced a `.tscn`
            // carrying `metadata/hidden = undefined` — a scene Godot refuses to
            // parse at all. It sits in plain sight in the counting house.
            hidden: false,
            description:
                'Brass, heavier than it looks, and worth precisely as much as the name it is issued '
                + 'against. Halle will want to see it.',
        },
    ],

    // ── The stair pays attention to who walks down it ─────────────────────────
    //
    // 0.45, matching the rate C3 measured as ALIVE rather than the module's 0.35
    // default — the number is authored here so the diorama's spawns are this
    // world's decision and not the engine's fallback.
    encounterAnchors: [
        {
            id: 'anchor-crooked-stair',
            zoneId: 'crooked-stair',
            encounterType: 'ambush',
            enemyIds: ['npc-stair-collector'],
            probability: 0.45,
            cooldownTurns: 3,
            tags: ['unbonded', 'contested'],
        },
    ],

    spawnPoints: [
        { id: 'start-counting-house', zoneId: 'counting-house', gridX: 4, gridY: 7, isDefault: true },
    ],

    craftingStations: [],

    marketNodes: [
        {
            id: 'market-weighing-floor',
            zoneId: 'weighing-floor',
            merchantEntityId: 'npc-corvane',
            supplyCategories: ['salt', 'tools'],
            priceModifier: 1.0,
            // Nothing unbonded changes hands on a Guild floor. The Warrens are where
            // that happens, and the Warrens have no market node at all.
            contrabandAvailable: false,
        },
    ],

    // ── The stone that does not look wet ─────────────────────────────────────
    //
    // A typed hazard, so the sim moves without a pack closure matching a magic
    // string — C3's `'loose cobbles'` flip is the proof that distinction is real.
    // Modest damage on entry: this is a harbour, not a trap corridor. The point is
    // that it is authored data with consequences, and that the prose said it was
    // there before any of this did.
    hazardDefinitions: [
        {
            id: 'tide-slick',
            name: 'Tide-Slick Stone',
            effects: [{ kind: 'damage', amount: 2, tickOn: 'turn-end' }],
            trigger: 'on-enter',
            moveCostDelta: 1,
            tags: ['terrain', 'harbour', 'wet'],
        },
    ],

    // ── Assets ───────────────────────────────────────────────────────────────
    //
    // Bound to the studio's OWN shipped sprite packs — the `-hd` line out of
    // sprite-foundry (townsfolk/heroes), which have been on npm since 2026-07-01 and
    // had no consumer inside the studio. The diorama consuming them is the first
    // time the production spine's output reaches a thing a person can look at.
    //
    // Paths are pack-relative and resolved by the client, not by the sim. `packId`
    // groups them so a later swap is one pack reference rather than five paths.
    assetPacks: [
        {
            id: 'sprite-foundry-townsfolk-hd',
            label: 'Sprite Foundry — Townsfolk HD',
            version: '1.1.0',
            description:
                'Eight-direction pre-rendered townsfolk from the studio\'s golden 3D path '
                + '(concept → TRELLIS.2 mesh → orbit pre-render → painterly restylize).',
            tags: ['character', 'hd', '8-direction'],
            theme: 'grounded',
            source: 'ai-generated',
            license: 'see @sprite-foundry/townsfolk-hd',
            author: 'mcp-tool-shop',
        },
    ],

    assets: [
        {
            id: 'sprite-corvane',
            kind: 'sprite',
            label: 'Assay Master Corvane',
            path: 'townsfolk-hd/merchant/',
            tags: ['npc', '8-direction'],
            packId: 'sprite-foundry-townsfolk-hd',
        },
        {
            id: 'sprite-halle',
            kind: 'sprite',
            label: 'Bonded Clerk Halle',
            path: 'townsfolk-hd/clerk/',
            tags: ['npc', '8-direction'],
            packId: 'sprite-foundry-townsfolk-hd',
        },
        {
            id: 'tileset-harbour-stone',
            kind: 'tileset',
            label: 'Harbour Stone',
            path: 'tilesets/harbour-stone.png',
            tags: ['exterior', 'wet'],
        },
    ],

    // ── The visual layer ─────────────────────────────────────────────────────
    //
    // ⚠ REQUIRED FIELDS the project validator does not check. `tilesets`,
    // `tileLayers`, `props`, `propPlacements` and `ambientLayers` are all
    // non-optional on `WorldProject`, and a world omitting every one of them
    // validated CLEAN. The typecheck caught it; `validateProject` did not.
    //
    // They are authored properly rather than as five empty arrays, because the
    // diorama has to stand on something: without a ground layer it is people and
    // gates floating on nothing.
    tilesets: [
        {
            id: 'harbour-stone',
            name: 'Harbour Stone',
            tileWidth: 32,
            tileHeight: 32,
            imagePath: 'tilesets/harbour-stone.png',
            imageWidth: 128,
            imageHeight: 128,
            tiles: [
                { id: 'stone-dry', tilesetId: 'harbour-stone', row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
                { id: 'stone-wet', tilesetId: 'harbour-stone', row: 0, col: 1, tags: ['floor', 'wet'], walkable: true, opacity: 1 },
                { id: 'plank', tilesetId: 'harbour-stone', row: 1, col: 0, tags: ['floor', 'timber'], walkable: true, opacity: 1 },
                { id: 'brick-worn', tilesetId: 'harbour-stone', row: 1, col: 1, tags: ['floor', 'warren'], walkable: true, opacity: 1 },
            ],
        },
    ],

    // A ground layer under the quay, and the wet strip along the lip the description
    // already told the player about. The tiles are the prose being true: `stone-wet`
    // runs exactly where `tide-slick` is.
    tileLayers: [
        {
            id: 'ground',
            name: 'Ground',
            zIndex: -10,
            tiles: [
                { tileId: 'stone-dry', gridX: 10, gridY: 13 },
                { tileId: 'stone-dry', gridX: 12, gridY: 13 },
                { tileId: 'stone-dry', gridX: 14, gridY: 13 },
                { tileId: 'stone-dry', gridX: 16, gridY: 13 },
                { tileId: 'stone-dry', gridX: 18, gridY: 13 },
                { tileId: 'stone-dry', gridX: 20, gridY: 13 },
                { tileId: 'stone-dry', gridX: 22, gridY: 13 },
                // The lip. Wet, and it does not look wet.
                { tileId: 'stone-wet', gridX: 10, gridY: 18 },
                { tileId: 'stone-wet', gridX: 12, gridY: 18 },
                { tileId: 'stone-wet', gridX: 14, gridY: 18 },
                { tileId: 'stone-wet', gridX: 16, gridY: 18 },
                { tileId: 'stone-wet', gridX: 18, gridY: 18 },
                { tileId: 'stone-wet', gridX: 20, gridY: 18 },
                { tileId: 'stone-wet', gridX: 22, gridY: 18 },
                { tileId: 'plank', gridX: 11, gridY: 4 },
                { tileId: 'plank', gridX: 13, gridY: 4 },
                { tileId: 'plank', gridX: 15, gridY: 4 },
                { tileId: 'brick-worn', gridX: 5, gridY: 21 },
                { tileId: 'brick-worn', gridX: 7, gridY: 23 },
            ],
        },
    ],

    // Every prop here is named in a zone's description. Nothing is placed that the
    // prose did not already put there — the writing came first and this is it being
    // made physical, which is the order the whole file is authored in.
    props: [
        { id: 'prop-scales', name: 'Brass Scales', width: 1, height: 1, tags: ['assay'], walkable: false, interactable: true },
        { id: 'prop-hawsers', name: 'Coiled Hawsers', width: 2, height: 1, tags: ['harbour'], walkable: false, interactable: true },
        { id: 'prop-crate-sealed', name: 'Crate Under Seal', width: 1, height: 1, tags: ['bonded'], walkable: false, interactable: false },
        { id: 'prop-cage', name: 'The Open Cage', width: 2, height: 2, tags: ['bonded', 'unclaimed'], walkable: false, interactable: true },
        { id: 'prop-desk', name: 'Standing Desk', width: 1, height: 1, tags: ['office'], walkable: false, interactable: true },
        { id: 'prop-crane', name: 'The Crane', width: 2, height: 3, tags: ['harbour', 'machinery'], walkable: false, interactable: false },
    ],

    propPlacements: [
        { id: 'pp-desk', propId: 'prop-desk', gridX: 3, gridY: 5, zoneId: 'counting-house' },
        // Six scales, and the third one is the one that matters.
        { id: 'pp-scale-1', propId: 'prop-scales', gridX: 11, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-scale-2', propId: 'prop-scales', gridX: 12, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-scale-3', propId: 'prop-scales', gridX: 13, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-scale-4', propId: 'prop-scales', gridX: 14, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-scale-5', propId: 'prop-scales', gridX: 15, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-scale-6', propId: 'prop-scales', gridX: 16, gridY: 6, zoneId: 'weighing-floor' },
        { id: 'pp-cage', propId: 'prop-cage', gridX: 25, gridY: 6, zoneId: 'bonded-warehouse' },
        { id: 'pp-crate-1', propId: 'prop-crate-sealed', gridX: 21, gridY: 4, zoneId: 'bonded-warehouse' },
        { id: 'pp-crate-2', propId: 'prop-crate-sealed', gridX: 22, gridY: 4, zoneId: 'bonded-warehouse' },
        { id: 'pp-crate-3', propId: 'prop-crate-sealed', gridX: 23, gridY: 4, zoneId: 'bonded-warehouse' },
        { id: 'pp-hawsers', propId: 'prop-hawsers', gridX: 12, gridY: 16, zoneId: 'long-quay' },
        { id: 'pp-crane', propId: 'prop-crane', gridX: 19, gridY: 14, zoneId: 'long-quay' },
    ],

    // The quay has weather; the bottom of the stair does not. `shadow` there is the
    // twenty-two steps nobody sweeps.
    ambientLayers: [
        {
            id: 'harbour-haze',
            name: 'Harbour Haze',
            zoneIds: ['long-quay'],
            type: 'fog',
            intensity: 0.25,
            color: '#b8c4cc',
        },
        {
            id: 'stairwell-dark',
            name: 'Stairwell Dark',
            zoneIds: ['crooked-stair'],
            type: 'shadow',
            intensity: 0.55,
        },
    ],

    strata: [],
    stratumLinks: [],
    buildings: [],
    hubs: [],
    strongholds: [],
};
