/**
 * tres-serializer.test.ts — .tres text format.
 *
 * F-12eeba99 / F-d1f450d0: serializeTres is the public contract for zone,
 * district, dialogue, loot, and item resources.
 */

import { describe, it, expect } from 'vitest';
import { serializeTres, serializeResource, objectToTresFields } from '../tres-serializer.js';

describe('serializeTres', () => {
    it('emits a Godot 4 resource header and quoted/escaped string fields', () => {
        const body = serializeTres('GodotZoneResource', [
            { key: 'id', value: 'zone-entrance' },
            { key: 'displayName', value: 'The "Hall"' },
            { key: 'light', value: 6 },
            { key: 'tags', value: ['indoor', 'safe'] },
        ]);
        expect(body).toContain('[gd_resource type="Resource" script_class="GodotZoneResource" format=3]');
        expect(body).toContain('[resource]');
        expect(body).toContain('id = "zone-entrance"');
        expect(body).toContain('displayName = "The \\"Hall\\""');
        expect(body).toContain('light = 6');
        expect(body).toContain('tags = ["indoor", "safe"]');
    });
});

describe('serializeResource', () => {
    it('omits resourcePath and nodeName (scene-only) from the .tres body', () => {
        const body = serializeResource('GodotItemResource', {
            resourcePath: 'res://world_data/items/i1.tres',
            nodeName: 'Torch',
            itemId: 'item-torch',
            hidden: false,
        });
        expect(body).not.toContain('resourcePath');
        expect(body).not.toContain('nodeName');
        expect(body).toContain('itemId = "item-torch"');
        expect(body).toContain('hidden = false');
    });
});

describe('objectToTresFields', () => {
    it('skips undefined values', () => {
        const fields = objectToTresFields({ a: 1, b: undefined, c: 'x' });
        expect(fields.map((f) => f.key)).toEqual(['a', 'c']);
    });
});
