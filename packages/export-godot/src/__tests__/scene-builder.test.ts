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
import type { GodotTileLayer } from '../convert-tile-layers.js';
import type { GodotPropNode } from '../convert-props.js';

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

describe('buildWorldScene — tile layers (Wave B-2)', () => {
    const colorLayer: GodotTileLayer = {
        nodeName: 'Ground', id: 'tl-ground', name: 'Ground', zIndex: 0, tileSize: 32,
        atlasSources: [], cells: [], tileCount: 5, imageBacked: false,
    };
    const imageLayer: GodotTileLayer = {
        nodeName: 'Walls', id: 'tl-walls', name: 'Walls', zIndex: 1, tileSize: 16,
        atlasSources: [{
            tilesetId: 'img', texturePath: 'res://assets/tilesets/img.png',
            tileWidth: 16, tileHeight: 16, sourceId: 0,
            atlasCoords: [{ atlasX: 0, atlasY: 0 }, { atlasX: 3, atlasY: 2 }],
        }],
        cells: [
            { gridX: 0, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0 },
            { gridX: 1, gridY: 0, sourceId: 0, atlasX: 3, atlasY: 2 },
        ],
        tileCount: 2, imageBacked: true,
    };
    const withTiles = (tileLayers: GodotTileLayer[]) => ({ ...baseInput([makeZone()]), tileLayers });

    it('emits a TileMapLayer node referencing a TileSet sub-resource', () => {
        const tscn = buildWorldScene(withTiles([colorLayer]));
        expect(tscn).toContain('[node name="Ground" type="TileMapLayer" parent="."]');
        expect(tscn).toContain('tile_set = SubResource("TileSet_0")');
        expect(tscn).toContain('[sub_resource type="TileSet" id="TileSet_0"]');
        expect(tscn).toContain('tile_size = Vector2i(32, 32)');
    });

    it('carries placement count + image-backed flag as metadata', () => {
        const tscn = buildWorldScene(withTiles([colorLayer]));
        expect(tscn).toContain('metadata/layer_id = "tl-ground"');
        expect(tscn).toContain('metadata/tile_count = 5');
        expect(tscn).toContain('metadata/image_backed = false');
    });

    it('color-only layers carry no atlas source and no baked cells', () => {
        const tscn = buildWorldScene(withTiles([colorLayer]));
        expect(tscn).not.toContain('TileSetAtlasSource');
        expect(tscn).not.toContain('tile_map_data');
    });

    it('image-backed layers emit a texture ext_resource + atlas source + baked cells', () => {
        const tscn = buildWorldScene(withTiles([imageLayer]));
        expect(tscn).toContain('[ext_resource type="Texture2D" path="res://assets/tilesets/img.png" id="tiletex_0"]');
        expect(tscn).toContain('[sub_resource type="TileSetAtlasSource" id="TileAtlas_0_0"]');
        expect(tscn).toContain('texture = ExtResource("tiletex_0")');
        expect(tscn).toContain('texture_region_size = Vector2i(16, 16)');
        expect(tscn).toContain('0:0/0 = 0');
        expect(tscn).toContain('3:2/0 = 0');
        expect(tscn).toContain('sources/0 = SubResource("TileAtlas_0_0")');
        // Baked cells: format header (0,0) then the two cells.
        expect(tscn).toMatch(/tile_map_data = PackedByteArray\(0, 0,/);
        expect(tscn).toContain('metadata/image_backed = true');
    });

    it('counts tile sub-resources + textures in load_steps', () => {
        // 1 zone → 2 sub (rect+nav); image layer → 1 texture (ext) + 2 sub (atlas+tileset).
        // load_steps = 0 ext + 1 tex + 2 zone-sub + 2 tile-sub + 1 = 6
        const tscn = buildWorldScene(withTiles([imageLayer]));
        expect(tscn).toContain('load_steps=6');
    });

    it('dedupes colliding TileMapLayer sibling names', () => {
        const tscn = buildWorldScene(withTiles([
            colorLayer,
            { ...colorLayer, id: 'tl-ground-2' },
        ]));
        expect(tscn).toContain('[node name="Ground" type="TileMapLayer" parent="."]');
        expect(tscn).toContain('[node name="Ground_2" type="TileMapLayer" parent="."]');
    });

    it('omits tile nodes entirely when there are no tile layers', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('TileMapLayer');
    });
});

describe('buildWorldScene — props (Wave B-3 interiors)', () => {
    const prop: GodotPropNode = {
        nodeName: 'Barrel', id: 'pp1', propId: 'barrel', displayName: 'Barrel',
        position: { x: 32, y: 64 }, width: 1, height: 1, walkable: false, interactable: true,
        zoneId: 'zone-a',
    };
    const withProps = (props: GodotPropNode[]) => ({ ...baseInput([makeZone()]), props });

    it('emits a Props container with a Node2D per placement + metadata', () => {
        const tscn = buildWorldScene(withProps([prop]));
        expect(tscn).toContain('[node name="Props" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Barrel" type="Node2D" parent="Props"]');
        expect(tscn).toContain('position = Vector2(32, 64)');
        expect(tscn).toContain('metadata/prop_id = "pp1"');
        expect(tscn).toContain('metadata/prop_def = "barrel"');
        expect(tscn).toContain('metadata/walkable = false');
        expect(tscn).toContain('metadata/interactable = true');
    });

    it('emits image_path metadata only when the prop has one', () => {
        const noImg = buildWorldScene(withProps([prop]));
        expect(noImg).not.toContain('metadata/image_path');
        const withImg = buildWorldScene(withProps([{ ...prop, imagePath: 'props/barrel.png' }]));
        expect(withImg).toContain('metadata/image_path = "props/barrel.png"');
    });

    it('omits the Props container entirely when there are no props', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('name="Props"');
    });
});
