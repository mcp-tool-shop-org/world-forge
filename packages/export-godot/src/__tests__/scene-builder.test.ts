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
import type { GodotMarketNode, GodotCraftingStation } from '../convert-economy.js';
import type { GodotBuilding, GodotHub, GodotStronghold } from '../convert-structures.js';

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
        atlasSources: [], cells: [], solidCells: [], tileCount: 5, imageBacked: false,
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
        solidCells: [], tileCount: 2, imageBacked: true,
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

    it('emits StaticBody2D wall collision for non-walkable cells', () => {
        const wallLayer: GodotTileLayer = {
            ...colorLayer, id: 'tl-walls2', nodeName: 'Walls',
            solidCells: [{ gridX: 0, gridY: 0 }, { gridX: 2, gridY: 1 }],
        };
        const tscn = buildWorldScene(withTiles([wallLayer]));
        // One shared tile-sized rect + a StaticBody2D with a CollisionShape2D per solid cell.
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="WallRect_0"]');
        expect(tscn).toContain('size = Vector2(32, 32)');
        expect(tscn).toContain('[node name="Collision" type="StaticBody2D" parent="Walls"]');
        expect(tscn).toContain('[node name="WallShape_0" type="CollisionShape2D" parent="Walls/Collision"]');
        expect(tscn).toContain('[node name="WallShape_1" type="CollisionShape2D" parent="Walls/Collision"]');
        expect(tscn).toContain('shape = SubResource("WallRect_0")');
        // Centered on the cell: (0,0) → (16,16); (2,1) → (80, 48) at tileSize 32.
        expect(tscn).toContain('position = Vector2(16, 16)');
        expect(tscn).toContain('position = Vector2(80, 48)');
        expect(tscn).toContain('metadata/solid_count = 2');
    });

    it('emits no collision body when no cells are solid', () => {
        const tscn = buildWorldScene(withTiles([colorLayer]));
        expect(tscn).not.toContain('type="StaticBody2D" parent="Ground"');
        expect(tscn).toContain('metadata/solid_count = 0');
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

describe('buildWorldScene — town economy (Wave B-3)', () => {
    const market: GodotMarketNode = {
        nodeName: 'Market_m1', id: 'm1', zoneId: 'z1', position: { x: 64, y: 32 },
        supplyCategories: ['food', 'tools'], priceModifier: 1.2, contrabandAvailable: false, merchantEntityId: 'npc1',
    };
    const station: GodotCraftingStation = {
        nodeName: 'Crafting_c1', id: 'c1', zoneId: 'z1', position: { x: 96, y: 96 },
        stationType: 'forge', availableRecipes: ['iron-blade', 'horseshoe'],
    };

    it('emits Markets + CraftingStations containers with economy metadata', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), markets: [market], craftingStations: [station] });
        expect(tscn).toContain('[node name="Markets" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Market_m1" type="Node2D" parent="Markets"]');
        expect(tscn).toContain('position = Vector2(64, 32)');
        expect(tscn).toContain('metadata/market_id = "m1"');
        expect(tscn).toContain('metadata/supply_categories = "food,tools"');
        expect(tscn).toContain('metadata/price_modifier = 1.2');
        expect(tscn).toContain('metadata/merchant_entity_id = "npc1"');
        expect(tscn).toContain('[node name="CraftingStations" type="Node2D" parent="."]');
        expect(tscn).toContain('metadata/station_id = "c1"');
        expect(tscn).toContain('metadata/station_type = "forge"');
        expect(tscn).toContain('metadata/recipes = "iron-blade,horseshoe"');
    });

    it('omits economy containers when there are none', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('name="Markets"');
        expect(tscn).not.toContain('name="CraftingStations"');
    });
});

describe('buildWorldScene — town structures (buildings/hubs/strongholds)', () => {
    const buildingNode: GodotBuilding = {
        nodeName: 'Building_b1', id: 'b1', name: 'Inn', buildingType: 'tavern',
        position: { x: 96, y: 128 }, footprint: { w: 64, h: 96 }, widthTiles: 2, heightTiles: 3,
        zoneId: 'z1', interiorZoneId: 'inn-interior', tags: [],
    };
    const hubNode: GodotHub = {
        nodeName: 'Hub_h1', id: 'h1', name: 'Square', zoneId: 'z1', position: { x: 64, y: 32 },
        hubType: 'market-square', serviceTypes: ['market', 'inn'], connectedZoneIds: ['z2'],
    };
    const strongholdNode: GodotStronghold = {
        nodeName: 'Stronghold_s1', id: 's1', name: 'Keep', zoneId: 'z1', position: { x: 160, y: 64 },
        factionId: 'iron-legion', defenseLevel: 5, garrisonEntityIds: ['npc-guard'],
    };

    it('emits a building as a StaticBody2D footprint with a tile-sized collision rect', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), buildings: [buildingNode] });
        expect(tscn).toContain('[node name="Buildings" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Building_b1" type="StaticBody2D" parent="Buildings"]');
        expect(tscn).toContain('position = Vector2(96, 128)');
        expect(tscn).toContain('metadata/building_id = "b1"');
        expect(tscn).toContain('metadata/building_type = "tavern"');
        expect(tscn).toContain('metadata/footprint_tiles = "2x3"');
        expect(tscn).toContain('metadata/interior_zone_id = "inn-interior"');
        // Footprint collision: a RectangleShape2D sub-resource + a centered CollisionShape2D.
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="BuildingShape_0"]');
        expect(tscn).toContain('size = Vector2(64, 96)');
        expect(tscn).toContain('[node name="Footprint" type="CollisionShape2D" parent="Buildings/Building_b1"]');
        expect(tscn).toContain('position = Vector2(32, 48)');
        expect(tscn).toContain('shape = SubResource("BuildingShape_0")');
    });

    it('counts building footprint shapes in load_steps', () => {
        // 1 zone → 2 sub (rect+nav), 1 building → 1 sub. load_steps = 2 + 1 + 1 = 4
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), buildings: [buildingNode] });
        expect(tscn).toContain('load_steps=4');
    });

    it('emits Hubs + Strongholds containers with metadata at zone centers', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), hubs: [hubNode], strongholds: [strongholdNode] });
        expect(tscn).toContain('[node name="Hubs" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Hub_h1" type="Node2D" parent="Hubs"]');
        expect(tscn).toContain('metadata/hub_id = "h1"');
        expect(tscn).toContain('metadata/hub_type = "market-square"');
        expect(tscn).toContain('metadata/services = "market,inn"');
        expect(tscn).toContain('metadata/connected_zones = "z2"');
        expect(tscn).toContain('[node name="Strongholds" type="Node2D" parent="."]');
        expect(tscn).toContain('metadata/stronghold_id = "s1"');
        expect(tscn).toContain('metadata/faction_id = "iron-legion"');
        expect(tscn).toContain('metadata/defense_level = 5');
        expect(tscn).toContain('metadata/garrison = "npc-guard"');
    });

    it('omits structure containers when there are none', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('name="Buildings"');
        expect(tscn).not.toContain('name="Hubs"');
        expect(tscn).not.toContain('name="Strongholds"');
    });
});
