// scene-parseable.test.ts — the exporter must not produce a file Godot refuses to open.
//
// FOUND BY A CONSUMER, not by this repo's own suite, which is the point worth
// recording. C4 authored the first Forge world intended to be PLAYED rather than
// measured. It omitted `ItemPlacement.hidden`, and `scene-builder` emitted
// `metadata/hidden = ${item.hidden}` unguarded, so the export reported
// `success: true` and produced a `.tscn` whose line 85 read:
//
//     metadata/hidden = undefined
//
// Godot's response is `Parse Error ... [Resource file res://…/world.tscn:85]` and a
// refusal to load the scene at all — every zone, every gate, every prop, gone,
// because one optional field was absent.
//
// The 36-assertion headless engine smoke did not catch it. It could not: its proof
// world authors every field it touches, so the omitted-field case had never been
// exported. A suite proves the inputs it has.

import { describe, it, expect } from 'vitest';
import { buildWorldScene, type SceneBuildInput } from '../scene-builder.js';
import { convertZones } from '../convert-zones.js';
import type { WorldProject } from '@world-forge/schema';

/**
 * A `[node ...]` header must fully tokenize as `[node` + one-or-more
 * space-separated `key="value"` / `key=Bareword(args)` attributes + `]`.
 * Mirrors the same full-line, anchored tokenizer scene-builder.ts's internal
 * `assertParseable` uses (`NODE_HEADER_RE`), so tests using this exercise the
 * real Godot grammar, not a proxy for it. Module-scoped (not per-describe)
 * because more than one describe block below needs it.
 */
const NODE_HEADER_RE = /^\[node(?: [A-Za-z_][A-Za-z0-9_]*=(?:"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*\([^()]*\)))+\]$/;

/**
 * The smallest input `buildWorldScene` will accept: one zone, nothing else.
 *
 * Deliberately minimal so a failure here is about the guard and not about some
 * unrelated converter's shape.
 */
function minimalInput(): SceneBuildInput {
    return {
        projectName: 'Guard Probe',
        zones: [
            {
                resourcePath: 'res://world_data/zones/z.tres',
                id: 'z',
                displayName: 'Z',
                description: 'A zone.',
                tags: [],
                position: { x: 0, y: 0 },
                size: { x: 64, y: 64 },
                gridWidth: 2,
                gridHeight: 2,
                light: 5,
                noise: 5,
                hazards: [],
                neighbors: [],
                exits: [],
                interactables: [],
                nodeName: 'Z',
            },
        ],
        entities: { byZone: {}, all: [], dropped: [], incomplete: false },
        items: [],
        navigationLinks: [],
        spawnMarkers: [],
        transitions: [],
    } as unknown as SceneBuildInput;
}

describe('the emitted scene is always parseable', () => {
    it('a minimal scene contains no bare undefined / null / NaN', () => {
        const scene = buildWorldScene(minimalInput());
        // The property VALUE side only — the words are legal inside quoted strings.
        expect(scene.split('\n').filter((l) => /=\s*(undefined|null|NaN)\s*$/.test(l))).toEqual([]);
    });

    it('RED CONTROL: an item missing `hidden` is REFUSED, not silently emitted', () => {
        // The exact defect, reproduced. `hidden` is required by the schema; a world
        // that omits it used to reach Godot as the token `undefined`.
        const input = minimalInput() as unknown as { items: unknown[] };
        input.items = [
            {
                resourcePath: 'res://world_data/items/seal.tres',
                itemId: 'guild-seal',
                displayName: 'The Guild Seal',
                zoneId: 'z',
                localPosition: { x: 8, y: 8 },
                nodeName: 'The_Guild_Seal',
                slot: 'tool',
                rarity: 'uncommon',
                // `hidden` deliberately absent — this is the bug.
            },
        ];

        expect(() => buildWorldScene(input as unknown as SceneBuildInput)).toThrowError(
            /refusing to emit an unparseable scene/,
        );
    });

    it('the refusal names the offending line and says how to fix it', () => {
        // A guard whose message does not locate the problem just moves the debugging
        // from Godot's parser to this repo's stack trace.
        const input = minimalInput() as unknown as { items: unknown[] };
        input.items = [
            {
                resourcePath: 'res://world_data/items/x.tres',
                itemId: 'x',
                zoneId: 'z',
                localPosition: { x: 0, y: 0 },
                nodeName: 'X',
            },
        ];

        let message = '';
        try {
            buildWorldScene(input as unknown as SceneBuildInput);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }

        expect(message).toContain('metadata/hidden = undefined');
        expect(message).toMatch(/line \d+/);
        expect(message).toContain('Godot');
        // The actionable half: what a reader should DO about it.
        expect(message).toContain('author the missing field');
    });

    it('a legitimate string containing the word "undefined" is NOT refused', () => {
        // The guard checks the value side and anchors at end-of-line, so prose is safe.
        // Without that narrowing, this world would be unexportable for its name alone —
        // a guard that blocks valid content is worse than the bug it prevents.
        const input = minimalInput();
        // The description is what actually reaches the scene, as
        // `metadata/description` — `displayName` is not emitted, which a first draft of
        // this test assumed and asserted on.
        input.zones[0].description = 'The berth is undefined on every chart the harbour keeps.';

        const scene = buildWorldScene(input);
        expect(scene).toContain('undefined on every chart');
        expect(scene).toContain('metadata/description = "The berth is undefined');
    });

    it('RED CONTROL: a non-finite numeric metadata value (Infinity) is REFUSED, not silently emitted', () => {
        // F-007 (audit): the guard's original blocklist matched bare
        // undefined/null/NaN but not Infinity/-Infinity, even though JS
        // stringifies a non-finite number as exactly that bare token via the
        // same unguarded template-literal path (e.g. `metadata/light =
        // ${zone.light}`). Same defect class as the undefined/hidden bug
        // above, left half-closed.
        const input = minimalInput();
        (input.zones[0] as unknown as { light: number }).light = Infinity;

        expect(() => buildWorldScene(input)).toThrowError(/refusing to emit an unparseable scene/);
        let message = '';
        try {
            buildWorldScene(input);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }
        expect(message).toContain('metadata/light = Infinity');
    });

    it('RED CONTROL: a negative-infinite numeric metadata value (-Infinity) is REFUSED', () => {
        const input = minimalInput();
        (input.zones[0] as unknown as { light: number }).light = -Infinity;

        let message = '';
        try {
            buildWorldScene(input);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }
        expect(message).toContain('metadata/light = -Infinity');
    });
});

describe('the emitted scene always has well-formed [node ...] headers (F-001/F-18d722e0)', () => {
    // The trap this whole class of test has to avoid: a corrupted header like
    //   [node name="Big_"Boss"_Tony" type="Node2D" parent="."]
    // has SIX quote characters — evenly balanced. Any check that counts quotes
    // (or checks the count is even) passes this line. Only a check that
    // actually tokenizes the header the way Godot's tag-header parser does
    // can tell it apart from a well-formed one. `NODE_HEADER_RE` (module
    // scope, top of file) mirrors the same full-line, anchored tokenizer
    // scene-builder.ts's internal `assertParseable` uses, so these tests
    // exercise the real Godot grammar, not a proxy for it.

    it('RED CONTROL: a raw quote in a node name (bypassing sanitizeNodeName) is REFUSED by the structural backstop', () => {
        // Every node name reaching buildWorldScene is expected to already have
        // gone through sanitizeNodeName(). This constructs the input the way a
        // caller that skipped that step would — proving assertParseable's own
        // structural check is a real backstop, not a guard that structurally
        // cannot fire (the trap the package fell into with the undefined/
        // null/NaN-only regex the first time).
        const input = minimalInput();
        input.zones[0].nodeName = 'Big_"Boss"_Tony';

        let message = '';
        try {
            buildWorldScene(input);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }
        expect(message).toMatch(/refusing to emit an unparseable scene/);
        expect(message).toMatch(/\[node \.\.\.\] header/);
        expect(message).toContain('sanitizeNodeName');
    });

    it('a quote-count check would be fooled by the malformed header; the structural check is not', () => {
        // Documents the trap directly: the malformed header has an EVEN quote
        // count, same as a well-formed one, so a naive parity check gives no
        // signal either way. The regex-tokenizer check below is what actually
        // distinguishes them.
        const malformed = '[node name="Big_"Boss"_Tony" type="Node2D" parent="."]';
        const wellFormed = '[node name="Big_Boss_Tony" type="Node2D" parent="."]';
        const quoteCount = (s: string) => (s.match(/"/g) ?? []).length;

        expect(quoteCount(malformed) % 2).toBe(0); // even — a parity check sees nothing wrong
        expect(quoteCount(wellFormed) % 2).toBe(0); // also even — indistinguishable by count alone

        expect(NODE_HEADER_RE.test(malformed)).toBe(false);
        expect(NODE_HEADER_RE.test(wellFormed)).toBe(true);
    });

    it('END TO END: a zone authored with a nickname-style quote in its name produces a well-formed header', () => {
        // The real pipeline, not a hand-built fixture: convertZones() is the
        // call site the audit named as the riskiest (a free-text authored
        // display name flows straight into the sanitizer). Reproduces the
        // coordinator's own engine-verified repro case, minus the engine call.
        const project = {
            map: { tileSize: 32, gridWidth: 10, gridHeight: 10 },
            zones: [
                {
                    id: 'boss-den', name: 'Big "Boss" Tony', description: '', tags: [],
                    gridX: 0, gridY: 0, gridWidth: 2, gridHeight: 2,
                    light: 1, noise: 0, hazards: [], neighbors: [], exits: [], interactables: [],
                },
            ],
        } as unknown as WorldProject;

        const { zones } = convertZones(project);
        expect(zones[0].nodeName).not.toContain('"');

        const scene = buildWorldScene({
            projectName: 'Quote Probe',
            zones,
            entities: { byZone: {}, all: [], dropped: [], incomplete: false },
            items: [],
            navigationLinks: [],
            spawnMarkers: [],
            transitions: [],
        });

        const zoneHeaderLine = scene.split('\n').find((l) => l.startsWith('[node ') && l.includes('type="Node2D" parent="."'));
        expect(zoneHeaderLine).toBeDefined();
        // Structural proof, not a quote count: the whole line must tokenize as
        // a well-formed [node ...] header.
        expect(zoneHeaderLine).toMatch(NODE_HEADER_RE);
    });
});

describe('an empty name="" / parent="" is refused, not silently emitted (F-00cf78db)', () => {
    // The trap this class of test has to avoid: `parent=""` and `name=""` are
    // BOTH syntactically well-formed to NODE_HEADER_RE — a zero-length quoted
    // string is a perfectly legal attribute value by that tokenizer's own
    // grammar. So the malformed-header check above (which exists to catch an
    // UNESCAPED quote desyncing the tag) does not fire here at all; this is a
    // structurally distinct defect class assertParseable() did not use to
    // guard against. Verified against the real, installed Godot 4.7.stable
    // engine: a `parent=""` NodePath crashes the engine outright
    // (CrashHandlerException, signal 11) inside its own resource loader,
    // before any script runs — a segfault is a strictly worse failure mode
    // than the parse-error refusal this file's other guards produce.

    it('RED CONTROL: a zone with an empty nodeName (bypassing convertZones\' own fallback) is REFUSED', () => {
        // Every zone nodeName reaching buildWorldScene is expected to already
        // have gone through convertZones' uniqueZoneNodeName() fallback. This
        // constructs the input the way a caller that skipped that step would
        // (or the way convert-zones.ts itself did before F-00cf78db was
        // fixed) — proving assertParseable's own empty-value check is a real,
        // independent backstop, not a guard that structurally cannot fire.
        const input = minimalInput();
        input.zones[0].nodeName = '';

        expect(() => buildWorldScene(input)).toThrowError(/refusing to emit an unparseable scene/);

        let message = '';
        try {
            buildWorldScene(input);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }
        // Collision/Navigation are always emitted for every zone (collectSubResources
        // runs unconditionally), so an empty zone nodeName is sufficient on its own
        // to produce a `parent=""` line — no entities/items/etc. required.
        expect(message).toContain('parent=""');
        expect(message).toContain('Godot');
    });

    it('the refusal explains why this is worse than a parse error (real-engine segfault), not just "malformed"', () => {
        const input = minimalInput();
        input.zones[0].nodeName = '';

        let message = '';
        try {
            buildWorldScene(input);
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }
        expect(message).toMatch(/segfault|crash/i);
        expect(message).toContain('sanitizeNodeName');
    });

    it('CONTROL: an ordinary, non-empty nodeName is not refused', () => {
        const input = minimalInput();
        input.zones[0].nodeName = 'Z';
        expect(() => buildWorldScene(input)).not.toThrow();
    });

    it('CONTROL: parent="." (the ordinary root-child NodePath) is not mistaken for an empty parent', () => {
        // parent="." has length 1 — must not collide with the parent="" check.
        const tscn = buildWorldScene(minimalInput());
        expect(tscn).toContain('parent="."');
        expect(() => buildWorldScene(minimalInput())).not.toThrow();
    });

    it('scene root: an empty project name falls back to a non-empty root node name, not name=""', () => {
        // scene-builder.ts:135 had the identical gap as convert-zones.ts:116 —
        // sanitizeNodeName(input.projectName) with no fallback. A project
        // whose name sanitizes to '' produced a scene root itself named "".
        const input = { ...minimalInput(), projectName: '' };

        expect(() => buildWorldScene(input)).not.toThrow();
        const scene = buildWorldScene(input);
        const rootLine = scene.split('\n').find((l) => l.startsWith('[node ') && l.includes('type="Node2D"]') && !l.includes('parent='));
        expect(rootLine).toBeDefined();
        expect(rootLine).not.toContain('name=""');
        expect(rootLine).toMatch(NODE_HEADER_RE);
    });

    it('CONTROL: a normal project name is unaffected by the root-name fallback', () => {
        const scene = buildWorldScene({ ...minimalInput(), projectName: 'Dustwalk' });
        expect(scene).toContain('[node name="Dustwalk" type="Node2D"]');
    });
});

describe('quoted property values must be well-formed string literals (F-2d6bede0)', () => {
    it('RED: spawnCondition with an embedded quote is escaped, not raw, so assertParseable accepts it', () => {
        const input = minimalInput();
        input.entities = {
            byZone: {
                z: [{
                    nodeName: 'Npc1',
                    sceneTemplate: 'res://entities/npc/npc_generic.tscn',
                    entityId: 'e1',
                    zoneId: 'z',
                    localPosition: { x: 8, y: 8 },
                    role: 'npc',
                    tags: [],
                    spawnCondition: 'item:the "seal"',
                }],
            },
            all: [],
            dropped: [],
            incomplete: false,
        };
        expect(() => buildWorldScene(input)).not.toThrow();
        const scene = buildWorldScene(input);
        const line = scene.split('\n').find((l) => l.startsWith('metadata/spawn_condition'));
        expect(line).toMatch(/^metadata\/spawn_condition = "(?:[^"\\]|\\.)*"$/);
    });
});
