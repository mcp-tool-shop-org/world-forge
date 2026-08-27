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
import type { GodotItemResource } from '../convert-items.js';
import type { GodotTileLayer } from '../convert-tile-layers.js';
import type { GodotPropNode } from '../convert-props.js';
import type { GodotMarketNode, GodotCraftingStation } from '../convert-economy.js';
import type { GodotBuilding, GodotHub, GodotStronghold } from '../convert-structures.js';
import type { GodotStratum, GodotStratumLink } from '../convert-strata.js';
import type { GodotHazardPlacement } from '../convert-hazards.js';
import type { FidelityEntry } from '../fidelity.js';

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

    it('does not fill a walkable zone with a StaticBody2D AABB (F-24fcd136)', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ size: { x: 160, y: 96 } })]));
        // A filled hull on layer/mask 1 would block CharacterBody2D from the
        // walkable interior while NavigationRegion2D said walk.
        expect(tscn).not.toContain('type="StaticBody2D" parent="ZoneA"');
        expect(tscn).not.toContain('id="RectShape_0"');
        expect(tscn).not.toMatch(/size = Vector2\(160, 96\)/);
        expect(tscn).toContain('type="NavigationRegion2D" parent="ZoneA"');
    });

    it('emits a filled hull only for void/hazard collisionType (F-24fcd136)', () => {
        const walkable = buildWorldScene(baseInput([makeZone({ collisionType: 'walkable' })]));
        expect(walkable).not.toContain('type="StaticBody2D" parent="ZoneA"');
        expect(walkable).toContain('metadata/collision_type = "walkable"');

        const voidZone = buildWorldScene(baseInput([makeZone({ collisionType: 'void', size: { x: 160, y: 96 } })]));
        expect(voidZone).toContain('type="StaticBody2D" parent="ZoneA"');
        expect(voidZone).toContain('[sub_resource type="RectangleShape2D" id="RectShape_0"]');
        expect(voidZone).toContain('size = Vector2(160, 96)');
        expect(voidZone).toContain('position = Vector2(80, 48)');
        expect(voidZone).toContain('metadata/collision_type = "void"');

        const hazard = buildWorldScene(baseInput([makeZone({ collisionType: 'hazard' })]));
        expect(hazard).toContain('type="StaticBody2D" parent="ZoneA"');
    });

    it('does not emit a walkable NavigationRegion2D over a void hull (F-71730b5a)', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ collisionType: 'void', size: { x: 160, y: 96 } })]));
        expect(tscn).toContain('type="StaticBody2D" parent="ZoneA"');
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="RectShape_0"]');
        expect(tscn).toContain('size = Vector2(160, 96)');
        expect(tscn).not.toContain('type="NavigationRegion2D" parent="ZoneA"');
        expect(tscn).not.toContain('[sub_resource type="NavigationPolygon"');
        expect(tscn).not.toMatch(/vertices = PackedVector2Array\(0, 0, 160, 0, 160, 96, 0, 96\)/);
    });

    it('gives a walkable zone a NavigationRegion2D with a rectangular navmesh', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ size: { x: 160, y: 96 } })]));
        expect(tscn).toContain('[sub_resource type="NavigationPolygon" id="NavPoly_0"]');
        expect(tscn).toContain('vertices = PackedVector2Array(0, 0, 160, 0, 160, 96, 0, 96)');
        expect(tscn).toContain('polygons = [PackedInt32Array(0, 1, 2, 3)]');
        expect(tscn).toContain('type="NavigationRegion2D" parent="ZoneA"');
        expect(tscn).toContain('navigation_polygon = SubResource("NavPoly_0")');
    });

    it('counts ext + sub resources in the load_steps header', () => {
        // 2 walkable zones → 2 sub-resources (nav each; no filled hull), 0 ext → load_steps = 2 + 0 + 1 = 3
        const tscn = buildWorldScene(baseInput([
            makeZone({ id: 'a', nodeName: 'A' }),
            makeZone({ id: 'b', nodeName: 'B' }),
        ]));
        expect(tscn).toContain('load_steps=3');
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
        expect(tscn).toContain('[node name="Npc1" type="Node2D" parent="ZoneA/Entities"]');
        expect(tscn).toContain('metadata/entity_id = "e1"');
        expect(tscn).toContain('metadata/scene_template = "res://entities/npc/npc_generic.tscn"');
        expect(tscn).not.toContain('instance=ExtResource');
        expect(tscn).not.toContain('type="PackedScene"');
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
        // 1 walkable zone → 1 sub (nav); image layer → 1 texture (ext) + 2 sub (atlas+tileset).
        // load_steps = 1 tex + 1 zone-sub + 2 tile-sub + 1 = 5
        const tscn = buildWorldScene(withTiles([imageLayer]));
        expect(tscn).toContain('load_steps=5');
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

    it('leaves the walkable interior unblocked while wall cells still collide (F-24fcd136)', () => {
        const wallLayer: GodotTileLayer = {
            ...colorLayer, id: 'tl-walls2', nodeName: 'Walls',
            solidCells: [{ gridX: 0, gridY: 0 }, { gridX: 2, gridY: 1 }],
        };
        const tscn = buildWorldScene(withTiles([wallLayer]));
        // Walkable interior: no zone-filling hull.
        expect(tscn).not.toContain('type="StaticBody2D" parent="ZoneA"');
        expect(tscn).not.toMatch(/size = Vector2\(160, 96\)/);
        // Wall cells still get a StaticBody2D + per-cell CollisionShape2D.
        expect(tscn).toContain('type="StaticBody2D" parent="Walls"');
        expect(tscn).toContain('[node name="WallShape_0" type="CollisionShape2D" parent="Walls/Collision"]');
        expect(tscn).toContain('[node name="WallShape_1" type="CollisionShape2D" parent="Walls/Collision"]');
        expect(tscn).toContain('size = Vector2(32, 32)');
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

describe('buildWorldScene — item metadata escaping (F-003)', () => {
    const item = (over: Partial<GodotItemResource> = {}): GodotItemResource => ({
        resourcePath: 'res://world_data/items/i1.tres',
        nodeName: 'Vault_Key',
        itemId: 'i1',
        displayName: 'Vault Key',
        zoneId: 'zone-a',
        localPosition: { x: 8, y: 8 },
        hidden: false,
        ...over,
    });

    it('escapes a quote in item.container the same way display_name is escaped', () => {
        // F-003: item.container (packages/schema/src/entities.ts declares it
        // free-text `container?: string`, unlike the closed-union slot/rarity)
        // used to reach this line unescaped, two lines below a properly-escaped
        // display_name sibling.
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), items: [item({ container: 'the "Old Vault" chest' })] });
        const line = tscn.split('\n').find((l) => l.startsWith('metadata/container'));
        expect(line).toBeDefined();
        // Structural proof: the whole property line must be a well-formed
        // `key = "value"` with the internal quote backslash-escaped, matching
        // exactly how escapeGodot() already treats display_name.
        expect(line).toMatch(/^metadata\/container = "(?:[^"\\]|\\.)*"$/);
        expect(line).toContain('\\"Old Vault\\"');
    });

    it('escapes a quote in item.slot and item.rarity too', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            items: [item({ slot: 'weapon"', rarity: 'rare"' })],
        });
        const slotLine = tscn.split('\n').find((l) => l.startsWith('metadata/slot'));
        const rarityLine = tscn.split('\n').find((l) => l.startsWith('metadata/rarity'));
        expect(slotLine).toMatch(/^metadata\/slot = "(?:[^"\\]|\\.)*"$/);
        expect(rarityLine).toMatch(/^metadata\/rarity = "(?:[^"\\]|\\.)*"$/);
    });

    it('still emits an ordinary container value unescaped-looking (round-trips to the same text)', () => {
        // Escaping a value with nothing to escape must be a no-op — the fix
        // must not visibly change ordinary, already-safe metadata.
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), items: [item({ container: 'chest-01' })] });
        expect(tscn).toContain('metadata/container = "chest-01"');
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
        // 1 walkable zone → 1 sub (nav), 1 building → 1 sub. load_steps = 1 + 1 + 1 = 3
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), buildings: [buildingNode] });
        expect(tscn).toContain('load_steps=3');
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

describe('buildWorldScene — vertical strata (world modeling)', () => {
    const surface: GodotStratum = {
        nodeName: 'Stratum_surface', id: 'surface', name: 'Surface', order: 0, zBand: 0,
        zRange: { floor: 0, ceiling: 10 }, visibleStrata: ['under'],
    };
    const under: GodotStratum = {
        nodeName: 'Stratum_under', id: 'under', name: 'Cellar', order: -1, zBand: -100,
        visibleStrata: [],
    };
    const slink: GodotStratumLink = {
        nodeName: 'StratumLink_l1', id: 'l1', fromStratumId: 'surface', toStratumId: 'under',
        fromZoneId: 'zone-a', bidirectional: true, linkType: 'stairs', position: { x: 80, y: 48 },
    };

    it('emits a Strata container with per-stratum metadata', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), strata: [surface, under] });
        expect(tscn).toContain('[node name="Strata" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Stratum_surface" type="Node2D" parent="Strata"]');
        expect(tscn).toContain('metadata/order = 0');
        expect(tscn).toContain('metadata/z_band = 0');
        expect(tscn).toContain('metadata/z_floor = 0');
        expect(tscn).toContain('metadata/z_ceiling = 10');
        expect(tscn).toContain('metadata/visible_strata = "under"');
        expect(tscn).toContain('metadata/order = -1');
        expect(tscn).toContain('metadata/z_band = -100');
    });

    it('emits a StratumLinks container with metadata + position', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), stratumLinks: [slink] });
        expect(tscn).toContain('[node name="StratumLinks" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="StratumLink_l1" type="Node2D" parent="StratumLinks"]');
        expect(tscn).toContain('position = Vector2(80, 48)');
        expect(tscn).toContain('metadata/from_stratum = "surface"');
        expect(tscn).toContain('metadata/to_stratum = "under"');
        expect(tscn).toContain('metadata/link_type = "stairs"');
    });

    it('bands a zone z_index by its stratum and tags it with stratum_id', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone({ elevation: 3 })]),
            zoneStrata: { 'zone-a': { stratumId: 'under', zBand: -100 } },
        });
        // z = zBand (-100) + elevation (3) = -97, absolute.
        expect(tscn).toContain('z_index = -97');
        expect(tscn).toContain('z_as_relative = false');
        expect(tscn).toContain('metadata/stratum_id = "under"');
    });

    it('leaves elevation-only z_index untouched when a zone has no stratum', () => {
        const tscn = buildWorldScene(baseInput([makeZone({ elevation: 5 })]));
        expect(tscn).toContain('z_index = 5');
        expect(tscn).not.toContain('z_as_relative = false');
        expect(tscn).not.toContain('metadata/stratum_id');
    });

    it('omits strata containers when there are none', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('name="Strata"');
        expect(tscn).not.toContain('name="StratumLinks"');
    });
});

describe('buildWorldScene — typed hazards (world modeling)', () => {
    const hazard: GodotHazardPlacement = {
        nodeName: 'Hazard_z1_lava', hazardId: 'lava', zoneId: 'z1', position: { x: 64, y: 32 },
        size: { w: 128, h: 64 }, trigger: 'per-turn', moveCostDelta: 2, passable: 'flying-only',
        blocksVision: true, effects: 'damage:8@turn-end;ignite@0.3', effectCount: 2,
    };

    it('emits a hazard as an Area2D region with an inline collision rect + metadata', () => {
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), hazards: [hazard] });
        expect(tscn).toContain('[node name="Hazards" type="Node2D" parent="."]');
        expect(tscn).toContain('[node name="Hazard_z1_lava" type="Area2D" parent="Hazards"]');
        expect(tscn).toContain('position = Vector2(64, 32)');
        expect(tscn).toContain('metadata/hazard_id = "lava"');
        expect(tscn).toContain('metadata/trigger = "per-turn"');
        expect(tscn).toContain('metadata/move_cost_delta = 2');
        expect(tscn).toContain('metadata/passable = "flying-only"');
        expect(tscn).toContain('metadata/blocks_vision = true');
        expect(tscn).toContain('metadata/effect_count = 2');
        expect(tscn).toContain('metadata/effects = "damage:8@turn-end;ignite@0.3"');
        // Region: a RectangleShape2D sub-resource + a CollisionShape2D referencing it.
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="HazardShape_0"]');
        expect(tscn).toContain('size = Vector2(128, 64)');
        expect(tscn).toContain('[node name="Region" type="CollisionShape2D" parent="Hazards/Hazard_z1_lava"]');
        expect(tscn).toContain('shape = SubResource("HazardShape_0")');
    });

    it('counts hazard collision shapes in load_steps', () => {
        // 1 walkable zone → 1 sub (nav), 1 hazard → 1 sub. load_steps = 1 + 1 + 1 = 3
        const tscn = buildWorldScene({ ...baseInput([makeZone()]), hazards: [hazard] });
        expect(tscn).toContain('load_steps=3');
    });

    it('omits the Hazards container when there are none', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('name="Hazards"');
    });
});

describe('buildWorldScene — zone entry gates (world modeling)', () => {
    it('emits entry gate metadata on a gated zone node', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            zoneGates: { 'zone-a': { zoneId: 'zone-a', conditions: ['party-level:>=10', 'item:iron-key'], mode: 'hard', reason: 'You need the Iron Key.' } },
        });
        expect(tscn).toContain('metadata/entry_gate = "party-level:>=10;item:iron-key"');
        expect(tscn).toContain('metadata/entry_gate_mode = "hard"');
        expect(tscn).toContain('metadata/entry_gate_reason = "You need the Iron Key."');
    });

    it('omits the reason line when no reason is authored', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            zoneGates: { 'zone-a': { zoneId: 'zone-a', conditions: ['always'], mode: 'soft' } },
        });
        expect(tscn).toContain('metadata/entry_gate_mode = "soft"');
        expect(tscn).not.toContain('metadata/entry_gate_reason');
    });

    it('emits no gate metadata for an ungated zone', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn).not.toContain('metadata/entry_gate');
    });
});

describe('buildWorldScene — textureless entity/transition placeholders (F-e17190f1)', () => {
    it('a world with an NPC produces a .tscn with no missing PackedScene ExtResource', () => {
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
        expect(tscn).toContain('[node name="Npc1" type="Node2D" parent="ZoneA/Entities"]');
        expect(tscn).toContain('metadata/scene_template = "res://entities/npc/npc_generic.tscn"');
        expect(tscn).not.toMatch(/\[ext_resource type="PackedScene"/);
        expect(tscn).not.toContain('instance=ExtResource');
        expect(tscn).not.toContain('res://entities/npc/npc_generic.tscn" id="');
    });

    it('a stairwell is a loadable Area2D placeholder with CollisionShape2D so body_entered can fire', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            transitions: [{
                id: 'stair-1',
                zoneId: 'zone-a',
                targetZoneId: 'zone-b',
                type: 'stairwell',
                localPosition: { x: 32, y: 48 },
                sceneTemplate: 'res://transitions/stairwell.tscn',
                nodeName: 'Transition_stair_1',
            }],
        });
        expect(tscn).toContain('[node name="Transition_stair_1" type="Area2D" parent="ZoneA/Transitions"]');
        expect(tscn).toContain('metadata/scene_template = "res://transitions/stairwell.tscn"');
        expect(tscn).toContain('[node name="Trigger" type="CollisionShape2D" parent="ZoneA/Transitions/Transition_stair_1"]');
        expect(tscn).toContain('[sub_resource type="RectangleShape2D" id="TransitionShape"]');
        expect(tscn).toContain('shape = SubResource("TransitionShape")');
        expect(tscn).not.toMatch(/\[ext_resource type="PackedScene"/);
        expect(tscn).not.toContain('instance=ExtResource');
        expect(tscn).not.toContain('res://transitions/stairwell.tscn" id="');
    });
});

describe('buildWorldScene — quoted metadata escaping (F-2d6bede0)', () => {
    it('RED: spawnCondition item:the "seal" emits a well-formed quoted property', () => {
        const inst = {
            nodeName: 'Npc1' as const,
            sceneTemplate: 'res://entities/npc/npc_generic.tscn' as const,
            entityId: 'e1', zoneId: 'zone-a',
            localPosition: { x: 10, y: 10 },
            role: 'npc' as const, tags: [] as string[],
            spawnCondition: 'item:the "seal"',
            factionId: 'the "keepers"',
            dialogueId: 'dlg "one"',
        };
        const entities: GodotEntityManifest = {
            byZone: { 'zone-a': [inst] },
            all: [inst],
            dropped: [],
            incomplete: false,
        };
        const tscn = buildWorldScene(baseInput([makeZone()], entities));
        const line = tscn.split('\n').find((l) => l.startsWith('metadata/spawn_condition'));
        expect(line).toBeDefined();
        expect(line).toMatch(/^metadata\/spawn_condition = "(?:[^"\\]|\\.)*"$/);
        expect(line).toContain('\\"seal\\"');
        expect(tscn.split('\n').find((l) => l.startsWith('metadata/faction_id')))
            .toMatch(/^metadata\/faction_id = "(?:[^"\\]|\\.)*"$/);
        expect(tscn.split('\n').find((l) => l.startsWith('metadata/dialogue_id')))
            .toMatch(/^metadata\/dialogue_id = "(?:[^"\\]|\\.)*"$/);
        expect(tscn.split('\n').find((l) => l.startsWith('metadata/entity_id')))
            .toMatch(/^metadata\/entity_id = "(?:[^"\\]|\\.)*"$/);
    });
});

describe('buildWorldScene — connection condition (F-c8fc01b1)', () => {
    it('emits metadata/condition on NavigationLink2D when set', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            navigationLinks: [{
                fromZoneId: 'zone-a',
                toZoneId: 'zone-b',
                kind: 'door',
                bidirectional: true,
                condition: 'item:iron-key',
                transitionMode: 'door',
                startPosition: { x: 0, y: 0 },
                endPosition: { x: 32, y: 0 },
            }],
        });
        expect(tscn).toContain('[node name="Link_0" type="NavigationLink2D" parent="NavigationLinks"]');
        expect(tscn).toContain('metadata/condition = "item:iron-key"');
        expect(tscn).toContain('metadata/kind = "door"');
    });

    it('does not emit NavigationLink2D into a void zone (F-71730b5a)', () => {
        const tscn = buildWorldScene({
            ...baseInput([
                makeZone({ id: 'zone-a', nodeName: 'ZoneA' }),
                makeZone({ id: 'pit', nodeName: 'Pit', collisionType: 'void', position: { x: 160, y: 0 } }),
            ]),
            navigationLinks: [{
                fromZoneId: 'zone-a',
                toZoneId: 'pit',
                kind: 'door',
                bidirectional: true,
                transitionMode: 'door',
                startPosition: { x: 160, y: 48 },
                endPosition: { x: 160, y: 48 },
            }],
        });
        expect(tscn).not.toContain('type="NavigationLink2D"');
        expect(tscn).not.toContain('[node name="NavigationLinks"');
        expect(tscn).toContain('type="NavigationRegion2D" parent="ZoneA"');
        expect(tscn).not.toContain('type="NavigationRegion2D" parent="Pit"');
        expect(tscn).toContain('type="StaticBody2D" parent="Pit"');
    });
});

describe('buildWorldScene — TransitionShape tileSize (F-cb8a70e5)', () => {
    it('sizes the shared trigger rect from SceneBuildInput.tileSize', () => {
        const tscn = buildWorldScene({
            ...baseInput([makeZone()]),
            tileSize: 64,
            transitions: [{
                id: 'stair-1',
                zoneId: 'zone-a',
                targetZoneId: 'zone-b',
                type: 'stairwell',
                localPosition: { x: 32, y: 48 },
                sceneTemplate: 'res://transitions/stairwell.tscn',
                nodeName: 'Transition_stair_1',
            }],
        });
        expect(tscn).toMatch(
            /\[sub_resource type="RectangleShape2D" id="TransitionShape"\]\nsize = Vector2\(64, 64\)/,
        );
    });
});

describe('buildWorldScene — per-project uid (F-a5afd9fd)', () => {
    it('two different projectIds produce two different uid= values', () => {
        const a = buildWorldScene({ ...baseInput([makeZone()]), projectId: 'world-alpha' });
        const b = buildWorldScene({ ...baseInput([makeZone()]), projectId: 'world-beta' });
        expect(a).toContain('uid="uid://wf_world_alpha"');
        expect(b).toContain('uid="uid://wf_world_beta"');
        expect(a.match(/uid="([^"]+)"/)?.[1]).not.toBe(b.match(/uid="([^"]+)"/)?.[1]);
    });

    it('omits uid when no projectId is provided so Godot can assign one', () => {
        const tscn = buildWorldScene(baseInput([makeZone()]));
        expect(tscn.startsWith('[gd_scene load_steps=')).toBe(true);
        expect(tscn.split('\n')[0]).not.toContain('uid=');
    });
});

describe('buildWorldScene — root-level name registry (F-6599ac0d)', () => {
    it('renames a zone that collides with reserved Camera2D', () => {
        const fidelity: FidelityEntry[] = [];
        const tscn = buildWorldScene({
            ...baseInput([makeZone({ id: 'cam-zone', nodeName: 'Camera2D' })]),
            fidelity,
        });
        expect(tscn).toContain('[node name="Camera2D" type="Camera2D" parent="."]');
        expect(tscn).toContain('[node name="Camera2D_2" type="Node2D" parent="."]');
        expect(fidelity.some((f) => f.level === 'approximated' && f.message.includes('Camera2D'))).toBe(true);
    });

    it('renames a zone that collides with a tile layer named Ground', () => {
        const fidelity: FidelityEntry[] = [];
        const groundLayer: GodotTileLayer = {
            nodeName: 'Ground', id: 'tl-ground', name: 'Ground', zIndex: 0, tileSize: 32,
            atlasSources: [], cells: [], solidCells: [], tileCount: 0, imageBacked: false,
        };
        const tscn = buildWorldScene({
            ...baseInput([makeZone({ id: 'z-ground', nodeName: 'Ground' })]),
            tileLayers: [groundLayer],
            fidelity,
        });
        expect(tscn).toContain('[node name="Ground" type="TileMapLayer" parent="."]');
        expect(tscn).toContain('[node name="Ground_2" type="Node2D" parent="."]');
        expect(fidelity.some((f) => f.entityId === 'z-ground' && f.message.includes('tile-layer:tl-ground'))).toBe(true);
    });
});

describe('buildWorldScene — zone 2.5D metadata (F-af27217d)', () => {
    it('emits parallax/skyline/physics metadata from the zone resource', () => {
        const tscn = buildWorldScene(baseInput([makeZone({
            parallaxLayers: [{ id: 'far', depth: 100, assetRef: 'sky', scrollFactor: 0.2 }],
            skylineRef: 'sky',
            physicsMode: 'platformer',
            timeOfDay: 'dusk',
            gravityOverride: 3.7,
        })]));
        expect(tscn).toContain('metadata/skyline_ref = "sky"');
        expect(tscn).toContain('metadata/physics_mode = "platformer"');
        expect(tscn).toContain('metadata/time_of_day = "dusk"');
        expect(tscn).toContain('metadata/gravity_override = 3.7');
        expect(tscn).toContain('metadata/parallax_count = 1');
        expect(tscn).toContain('metadata/parallax_layers =');
        expect(tscn).toContain('far');
    });
});
