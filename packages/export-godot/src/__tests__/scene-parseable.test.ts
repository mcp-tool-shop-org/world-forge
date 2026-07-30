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
});
