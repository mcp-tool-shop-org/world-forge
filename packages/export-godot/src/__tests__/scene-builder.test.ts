/**
 * scene-builder.test.ts — Wave B-1 playable-scene-scaffold coverage.
 *
 * The Godot lane previously shipped with no unit tests; these lock the .tscn
 * structure the real-engine smoke (dogfood/run-godot-smoke.ts) verifies, so the
 * scaffold (collision / navmesh / camera / y-sort) can't silently regress.
 */

import { describe, it, expect } from 'vitest';
import { buildWorldScene, type SceneBuildInput } from '../scene-builder.js';
import type { GodotZoneResource } from '../convert-zones.js';
import type { GodotEntityManifest } from '../convert-entities.js';

function makeZone(overrides: Partial<GodotZoneResource> = {}): GodotZoneResource {
    return {
        resourcePath: 'res://world_data/zones/z.tres',
        id: 'zone-a',
        displayName: 'Zone A',
        description: 'A test zone',
        tags: [],
        position: { x: 0, y: 0 },
        size: { x: 160, y: 96 },
        gridWidth: 5,
        gridHeight: 3,
        light: 1,
        noise: 0,
        hazards: [],
        neighbors: [],
        exits: [],
        interactables: [],
        nodeName: 'ZoneA',
        ...overrides,
    };
}

const EMPTY_ENTITIES: GodotEntityManifest = { byZone: {}, all: [], dropped: [], incomplete: false };

function baseInput(zones: GodotZoneResource[], entities: GodotEntityManifest = EMPTY_ENTITIES): SceneBuildInput {
    return {
        projectName: 'Test World',
        zones,
        entities,
        items: [],
        navigationLinks: [],
        spawnMarkers: [],
        transitions: [],
    };
}

describe('buildWorldScene — playable scaffold (Wave B-1)', () => {
    it('emits a framed Camera2D on the root', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).toContain('[node name="Camera2D" type="Camera2D" parent="."]');
    });

    it('y-sorts the root and each zone for 2.5D depth', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        const count = (tscn.match(/y_sort_enabled = true/g) ?? []).length;
        expect(count).toBeGreaterThanOrEqual(2); // root + zone
    });

    it('gives every zone a StaticBody2D collision hull centered on the zone', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ size: { x: 160, y: 96 } })]));
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="RectShape_0"]');
        expect(tscn).toContain('size = Vector2(160, 96)');
        expect(tscn).toContain('type="StaticBody2D" parent="ZoneA"');
        expect(tscn).toContain('shape = SubResource("RectShape_0")');
        expect(tscn).toContain('position = Vector2(80, 48)'); // centered
    });

    it('gives every zone a NavigationRegion2D with a rectangular navmesh', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ size: { x: 160, y: 96 } })]));
        expect(tscn).toContain('[sub_resource type="NavigationPolygon" id="NavPoly_0"]');
        expect(tscn).toContain('vertices = PackedVector2Array(0, 0, 160, 0, 160, 96, 0, 96)');
        expect(tscn).toContain('polygons = [PackedInt32Array(0, 1, 2, 3)]');
        expect(tscn).toContain('type="NavigationRegion2D" parent="ZoneA"');
        expect(tscn).toContain('navigation_polygon = SubResource("NavPoly_0")');
    });

    it('counts ext + sub resources in the load_steps header', () => {
        // 2 zones → 4 sub-resources (rect + nav each), 0 ext → load_steps = 4 + 0 + 1 = 5
        const tscn = buildWorldScene(baseInput([
            makeZone({ id: 'a', nodeName: 'A' }),
            makeZone({ id: 'b', nodeName: 'B' }),
        ]));
        expect(tscn).toContain('load_steps=5');
    });

    it('emits z_index from elevation only when elevation is set', () => {
        const withElev = buildWorldScene(baseInput([makeZone({ elevation: 12.4 })]));
        expect(withElev).toContain('z_index = 12');
        const noElev = buildWorldScene(baseInput([makeZone()]));
        expect(noElev).not.toContain('z_index =');
    });

    it('clamps z_index to Godot CanvasItem limits', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ elevation: 99999 })]));
        expect(tscn).toContain('z_index = 4096');
    });

    it('frames the camera at the world bounding-box center', () => {
        // zone a [0,160]x[0,96], zone b [200,240]x[0,96] → bbox center (120, 48)
        const tscn = buildWorldScene(baseInput([
            makeZone({ id: 'a', nodeName: 'A', position: { x: 0, y: 0 }, size: { x: 160, y: 96 } }),
            makeZone({ id: 'b', nodeName: 'B', position: { x: 200, y: 0 }, size: { x: 40, y: 96 } }),
        ]));
        expect(tscn).toContain('[node name="Camera2D" type="Camera2D" parent="."]');
        expect(tscn).toContain('position = Vector2(120, 48)');
    });

    it('still emits entity instances alongside the scaffold', () => {
        const inst = {
            nodeName: 'Npc1' as const,
            sceneTemplate: 'res://entities/npc/npc_generic.tscn' as const,
            entityId: 'e1', zoneId: 'zone-a',
            localPosition: { x: 10, y: 10 },
            role: 'npc' as const, tags: [] as string[],
        };
        const entities: GodotEntityManifest = {
            byZone: { 'zone-a': [inst] },
            all: [inst],
            dropped: [],
            incomplete: false,
        };
        const tscn = buildWorldScene(baseInput([makeZone()], entities));
        expect(tscn).toContain('[node name="Entities" type="Node2D" parent="ZoneA"]');
        expect(tscn).toContain('metadata/entity_id = "e1"');
    });

    it('handles a zero-zone world without crashing (camera at origin)', () => {
        const tscn = buildWorldScene(baseInput([]));
        expect(tscn).toContain('[node name="Camera2D" type="Camera2D" parent="."]');
        expect(tscn).toContain('position = Vector2(0, 0)');
        expect(tscn).toContain('load_steps=1');
    });
});
