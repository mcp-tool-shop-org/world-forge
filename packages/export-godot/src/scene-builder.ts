/**
 * scene-builder.ts — Compose converted data into Godot .tscn text format.
 *
 * Generates valid Godot 4 scene files that can be opened directly in the editor.
 * Format reference: https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html
 *
 * Scene tree structure:
 *   World (Node2D, y_sort_enabled)
 *   ├── Camera2D — framed on the world bounding box so the scene is visible on open
 *   ├── <ZoneName> (Node2D) — at zone origin, y_sort_enabled, z_index from elevation
 *   │   ├── Collision (StaticBody2D)
 *   │   │   └── CollisionShape2D — RectangleShape2D covering the zone bounds
 *   │   ├── Navigation (NavigationRegion2D) — rectangular NavigationPolygon
 *   │   ├── Entities/ (Node2D)
 *   │   │   └── <EntityName> (Node2D) — instance of scene template
 *   │   ├── Items/ (Node2D)
 *   │   ├── SpawnPoints/ (Node2D)
 *   │   │   └── <SpawnName> (Marker2D)
 *   │   └── Transitions/ (Node2D)
 *   │       └── <TransitionName> (Area2D)
 *   └── NavigationLinks/ (Node2D)
 *
 * Wave B-1: the scene ships a playable scaffold — per-zone collision bodies,
 * per-zone navigation regions, a framed Camera2D, and 2.5D y-sort / z-index — so
 * a world-forge export opens in Godot as a navigable, collidable, visible scene
 * rather than a metadata-only graph.
 */

import type { GodotZoneResource } from './convert-zones.js';
import type { GodotEntityManifest } from './convert-entities.js';
import type { GodotItemResource } from './convert-items.js';
import type { GodotNavigationLink } from './convert-connections.js';
import type { GodotSpawnMarker } from './convert-spawn-points.js';
import type { GodotTransitionNode } from './convert-transitions.js';
import { encodeTileMapData, type GodotTileLayer } from './convert-tile-layers.js';

export interface SceneBuildInput {
    projectName: string;
    zones: GodotZoneResource[];
    entities: GodotEntityManifest;
    items: GodotItemResource[];
    navigationLinks: GodotNavigationLink[];
    spawnMarkers: GodotSpawnMarker[];
    transitions: GodotTransitionNode[];
    /** Tile layers → TileMapLayer nodes. Optional for back-compat with older callers. */
    tileLayers?: GodotTileLayer[];
}

/** Godot CanvasItem z_index hard limits (RenderingServer.CANVAS_ITEM_Z_MIN/MAX). */
const Z_INDEX_MIN = -4096;
const Z_INDEX_MAX = 4096;

/**
 * Build the main world .tscn file content (Godot 4 text scene format).
 * This produces a single scene file with all zones as child nodes.
 */
export function buildWorldScene(input: SceneBuildInput): string {
    const lines: string[] = [];
    const tileLayers = input.tileLayers ?? [];
    // External resources (scene templates referenced by entities/transitions).
    const extResources = collectExtResources(input);
    // Tile resources — TileSet/TileSetAtlasSource sub-resources + tileset textures.
    const tileResources = collectTileResources(tileLayers);
    // Sub-resources (per-zone collision shapes + navigation polygons).
    const subResources = collectSubResources(input.zones);

    // Header — load_steps counts every ext + sub resource plus the implicit scene step.
    const loadSteps = extResources.length + tileResources.textures.length
        + subResources.blocks.length + tileResources.subBlocks.length + 1;
    lines.push(`[gd_scene load_steps=${loadSteps} format=3 uid="uid://world_forge_export"]`);
    lines.push('');

    // External resource declarations — PackedScene templates, then tileset textures.
    for (let i = 0; i < extResources.length; i++) {
        lines.push(`[ext_resource type="PackedScene" uid="uid://ext_${i}" path="${extResources[i].path}" id="${extResources[i].id}"]`);
    }
    for (const tex of tileResources.textures) {
        lines.push(`[ext_resource type="Texture2D" path="${tex.path}" id="${tex.id}"]`);
    }
    if (extResources.length > 0 || tileResources.textures.length > 0) lines.push('');

    // Sub-resource declarations (must precede the nodes that reference them).
    for (const block of subResources.blocks) {
        lines.push(block);
        lines.push('');
    }
    for (const block of tileResources.subBlocks) {
        lines.push(block);
        lines.push('');
    }

    // Root node — y-sort enabled so 2.5D depth ordering works out of the box.
    lines.push(`[node name="${sanitize(input.projectName)}" type="Node2D"]`);
    lines.push('y_sort_enabled = true');
    lines.push('');

    // Framed camera so the exported scene is visible the moment it opens.
    const camera = worldCenter(input.zones);
    lines.push(`[node name="Camera2D" type="Camera2D" parent="."]`);
    lines.push(`position = Vector2(${camera.x}, ${camera.y})`);
    lines.push('');

    // Tile layers — TileMapLayer nodes (ground art) parented to the root. Image-
    // backed layers carry baked tile_map_data cells; color-only layers carry a
    // TileSet scaffold + placement metadata (cells load data-driven).
    lines.push(...emitTileMapLayers(tileLayers, tileResources.tileSetIdByLayer));

    // Zone nodes
    for (const zone of input.zones) {
        const ids = subResources.idsByZone.get(zone.id);
        const { w, h } = zoneExtent(zone);

        lines.push(`[node name="${zone.nodeName}" type="Node2D" parent="."]`);
        lines.push(`position = Vector2(${zone.position.x}, ${zone.position.y})`);
        lines.push('y_sort_enabled = true');
        if (zone.elevation !== undefined) {
            lines.push(`z_index = ${clampZ(Math.round(zone.elevation))}`);
        }
        lines.push(`metadata/zone_id = "${zone.id}"`);
        lines.push(`metadata/description = "${escapeGodot(zone.description)}"`);
        lines.push(`metadata/light = ${zone.light}`);
        lines.push(`metadata/noise = ${zone.noise}`);
        if (zone.elevation !== undefined) lines.push(`metadata/elevation = ${zone.elevation}`);
        if (zone.parentDistrictId) lines.push(`metadata/district_id = "${zone.parentDistrictId}"`);
        lines.push('');

        // Collision — a static rectangular hull covering the zone bounds so
        // characters collide with zone edges instead of falling through.
        if (ids) {
            lines.push(`[node name="Collision" type="StaticBody2D" parent="${zone.nodeName}"]`);
            lines.push('');
            lines.push(`[node name="CollisionShape2D" type="CollisionShape2D" parent="${zone.nodeName}/Collision"]`);
            lines.push(`position = Vector2(${w / 2}, ${h / 2})`);
            lines.push(`shape = SubResource("${ids.rect}")`);
            lines.push('');

            // Navigation — a rectangular navmesh so NPCs/the player can path
            // within the zone (NavigationLink2D only connects zones, not inside).
            lines.push(`[node name="Navigation" type="NavigationRegion2D" parent="${zone.nodeName}"]`);
            lines.push(`navigation_polygon = SubResource("${ids.nav}")`);
            lines.push('');
        }

        // Entities container
        const zoneEntities = input.entities.byZone[zone.id] ?? [];
        if (zoneEntities.length > 0) {
            lines.push(`[node name="Entities" type="Node2D" parent="${zone.nodeName}"]`);
            lines.push('');
            for (const entity of zoneEntities) {
                const extRef = extResources.find((r) => r.path === entity.sceneTemplate);
                if (extRef) {
                    lines.push(`[node name="${entity.nodeName}" parent="${zone.nodeName}/Entities" instance=ExtResource("${extRef.id}")]`);
                } else {
                    lines.push(`[node name="${entity.nodeName}" type="Node2D" parent="${zone.nodeName}/Entities"]`);
                }
                lines.push(`position = Vector2(${entity.localPosition.x}, ${entity.localPosition.y})`);
                lines.push(`metadata/entity_id = "${entity.entityId}"`);
                lines.push(`metadata/role = "${entity.role}"`);
                if (entity.displayName) lines.push(`metadata/display_name = "${escapeGodot(entity.displayName)}"`);
                if (entity.factionId) lines.push(`metadata/faction_id = "${entity.factionId}"`);
                if (entity.dialogueId) lines.push(`metadata/dialogue_id = "${entity.dialogueId}"`);
                if (entity.spawnCondition) lines.push(`metadata/spawn_condition = "${entity.spawnCondition}"`);
                lines.push('');
            }
        }

        // Items container
        const zoneItems = input.items.filter((i) => i.zoneId === zone.id);
        if (zoneItems.length > 0) {
            lines.push(`[node name="Items" type="Node2D" parent="${zone.nodeName}"]`);
            lines.push('');
            for (const item of zoneItems) {
                lines.push(`[node name="${item.nodeName}" type="Node2D" parent="${zone.nodeName}/Items"]`);
                lines.push(`position = Vector2(${item.localPosition.x}, ${item.localPosition.y})`);
                lines.push(`metadata/item_id = "${item.itemId}"`);
                if (item.displayName) lines.push(`metadata/display_name = "${escapeGodot(item.displayName)}"`);
                lines.push(`metadata/hidden = ${item.hidden}`);
                if (item.slot) lines.push(`metadata/slot = "${item.slot}"`);
                if (item.rarity) lines.push(`metadata/rarity = "${item.rarity}"`);
                if (item.container) lines.push(`metadata/container = "${item.container}"`);
                lines.push('');
            }
        }

        // Spawn points
        const zoneSpawns = input.spawnMarkers.filter((s) => s.zoneId === zone.id);
        if (zoneSpawns.length > 0) {
            lines.push(`[node name="SpawnPoints" type="Node2D" parent="${zone.nodeName}"]`);
            lines.push('');
            for (const sp of zoneSpawns) {
                lines.push(`[node name="${sp.nodeName}" type="Marker2D" parent="${zone.nodeName}/SpawnPoints"]`);
                lines.push(`position = Vector2(${sp.localPosition.x}, ${sp.localPosition.y})`);
                lines.push(`metadata/spawn_id = "${sp.id}"`);
                lines.push(`metadata/is_default = ${sp.isDefault}`);
                lines.push('');
            }
        }

        // Transitions
        const zoneTransitions = input.transitions.filter((t) => t.zoneId === zone.id);
        if (zoneTransitions.length > 0) {
            lines.push(`[node name="Transitions" type="Node2D" parent="${zone.nodeName}"]`);
            lines.push('');
            for (const tr of zoneTransitions) {
                const extRef = extResources.find((r) => r.path === tr.sceneTemplate);
                if (extRef) {
                    lines.push(`[node name="${tr.nodeName}" parent="${zone.nodeName}/Transitions" instance=ExtResource("${extRef.id}")]`);
                } else {
                    lines.push(`[node name="${tr.nodeName}" type="Area2D" parent="${zone.nodeName}/Transitions"]`);
                }
                lines.push(`position = Vector2(${tr.localPosition.x}, ${tr.localPosition.y})`);
                lines.push(`metadata/transition_id = "${tr.id}"`);
                lines.push(`metadata/target_zone = "${tr.targetZoneId}"`);
                lines.push(`metadata/type = "${tr.type}"`);
                if (tr.label) lines.push(`metadata/label = "${escapeGodot(tr.label)}"`);
                if (tr.durationSeconds !== undefined) lines.push(`metadata/duration = ${tr.durationSeconds}`);
                lines.push('');
            }
        }
    }

    // Navigation links as metadata on root
    if (input.navigationLinks.length > 0) {
        lines.push(`[node name="NavigationLinks" type="Node2D" parent="."]`);
        lines.push('');
        for (let i = 0; i < input.navigationLinks.length; i++) {
            const link = input.navigationLinks[i];
            lines.push(`[node name="Link_${i}" type="NavigationLink2D" parent="NavigationLinks"]`);
            lines.push(`start_position = Vector2(${link.startPosition.x}, ${link.startPosition.y})`);
            lines.push(`end_position = Vector2(${link.endPosition.x}, ${link.endPosition.y})`);
            lines.push(`bidirectional = ${link.bidirectional}`);
            lines.push(`metadata/from_zone = "${link.fromZoneId}"`);
            lines.push(`metadata/to_zone = "${link.toZoneId}"`);
            lines.push(`metadata/kind = "${link.kind}"`);
            lines.push(`metadata/transition_mode = "${link.transitionMode}"`);
            if (link.label) lines.push(`metadata/label = "${escapeGodot(link.label)}"`);
            lines.push('');
        }
    }

    return lines.join('\n');
}

interface ExtResourceRef {
    id: string;
    path: string;
}

function collectExtResources(input: SceneBuildInput): ExtResourceRef[] {
    const seen = new Set<string>();
    const refs: ExtResourceRef[] = [];

    for (const entity of input.entities.all) {
        if (!seen.has(entity.sceneTemplate)) {
            seen.add(entity.sceneTemplate);
            refs.push({ id: `ext_${refs.length}`, path: entity.sceneTemplate });
        }
    }
    for (const tr of input.transitions) {
        if (!seen.has(tr.sceneTemplate)) {
            seen.add(tr.sceneTemplate);
            refs.push({ id: `ext_${refs.length}`, path: tr.sceneTemplate });
        }
    }

    return refs;
}

interface TileResourceSet {
    /** Tileset texture ext_resources (deduped by path). */
    textures: { path: string; id: string }[];
    /** TileSetAtlasSource + TileSet sub-resource blocks, in declaration order. */
    subBlocks: string[];
    /** Map of tile layer id → its TileSet sub-resource id. */
    tileSetIdByLayer: Map<string, string>;
}

/**
 * Build the TileSet (and, for image-backed layers, TileSetAtlasSource)
 * sub-resources plus the tileset-texture ext_resources. Atlas-source blocks are
 * pushed before the TileSet that references them, satisfying .tscn ordering.
 */
function collectTileResources(tileLayers: GodotTileLayer[]): TileResourceSet {
    const textures: { path: string; id: string }[] = [];
    const textureIdByPath = new Map<string, string>();
    const subBlocks: string[] = [];
    const tileSetIdByLayer = new Map<string, string>();

    for (let li = 0; li < tileLayers.length; li++) {
        const layer = tileLayers[li];
        const tileSetId = `TileSet_${li}`;
        tileSetIdByLayer.set(layer.id, tileSetId);

        const sourceLines: string[] = [];
        for (const src of layer.atlasSources) {
            let texId = textureIdByPath.get(src.texturePath);
            if (!texId) {
                texId = `tiletex_${textures.length}`;
                textureIdByPath.set(src.texturePath, texId);
                textures.push({ path: src.texturePath, id: texId });
            }
            const atlasId = `TileAtlas_${li}_${src.sourceId}`;
            const tileDefs = src.atlasCoords.map((c) => `${c.atlasX}:${c.atlasY}/0 = 0`).join('\n');
            subBlocks.push(
                `[sub_resource type="TileSetAtlasSource" id="${atlasId}"]\n` +
                `texture = ExtResource("${texId}")\n` +
                `texture_region_size = Vector2i(${src.tileWidth}, ${src.tileHeight})` +
                (tileDefs ? '\n' + tileDefs : ''),
            );
            sourceLines.push(`sources/${src.sourceId} = SubResource("${atlasId}")`);
        }

        subBlocks.push(
            `[sub_resource type="TileSet" id="${tileSetId}"]\n` +
            `tile_size = Vector2i(${layer.tileSize}, ${layer.tileSize})` +
            (sourceLines.length > 0 ? '\n' + sourceLines.join('\n') : ''),
        );
    }

    return { textures, subBlocks, tileSetIdByLayer };
}

/** Emit TileMapLayer node blocks (parented to root). Sibling names are deduped. */
function emitTileMapLayers(tileLayers: GodotTileLayer[], tileSetIdByLayer: Map<string, string>): string[] {
    const lines: string[] = [];
    const seen = new Map<string, number>();
    for (const layer of tileLayers) {
        const base = sanitize(layer.nodeName) || 'TileLayer';
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const nodeName = n === 0 ? base : `${base}_${n + 1}`;

        lines.push(`[node name="${nodeName}" type="TileMapLayer" parent="."]`);
        const tsId = tileSetIdByLayer.get(layer.id);
        if (tsId) lines.push(`tile_set = SubResource("${tsId}")`);
        lines.push(`z_index = ${clampZ(Math.round(layer.zIndex))}`);
        if (layer.cells.length > 0) {
            lines.push(`tile_map_data = PackedByteArray(${encodeTileMapData(layer.cells).join(', ')})`);
        }
        lines.push(`metadata/layer_id = "${escapeGodot(layer.id)}"`);
        lines.push(`metadata/tile_count = ${layer.tileCount}`);
        lines.push(`metadata/image_backed = ${layer.imageBacked}`);
        lines.push('');
    }
    return lines;
}

interface SubResourceSet {
    /** Sub-resource declaration blocks, in declaration order. */
    blocks: string[];
    /** Map of zone id → the sub-resource ids that zone's nodes reference. */
    idsByZone: Map<string, { rect: string; nav: string }>;
}

/**
 * Build the per-zone collision-shape and navigation-polygon sub-resources.
 * Ids are index-based (RectShape_N / NavPoly_N) so they are always valid Godot
 * SubResource ids regardless of zone naming.
 */
function collectSubResources(zones: GodotZoneResource[]): SubResourceSet {
    const blocks: string[] = [];
    const idsByZone = new Map<string, { rect: string; nav: string }>();

    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        const { w, h } = zoneExtent(zone);
        const rect = `RectShape_${i}`;
        const nav = `NavPoly_${i}`;

        blocks.push(
            `[sub_resource type="RectangleShape2D" id="${rect}"]\n` +
            `size = Vector2(${w}, ${h})`,
        );
        // Rectangular navmesh in zone-local space: (0,0) (w,0) (w,h) (0,h).
        blocks.push(
            `[sub_resource type="NavigationPolygon" id="${nav}"]\n` +
            `vertices = PackedVector2Array(0, 0, ${w}, 0, ${w}, ${h}, 0, ${h})\n` +
            `polygons = [PackedInt32Array(0, 1, 2, 3)]`,
        );

        idsByZone.set(zone.id, { rect, nav });
    }

    return { blocks, idsByZone };
}

/** Zone pixel extent, rounded and clamped to a minimum of 1px to avoid degenerate shapes. */
function zoneExtent(zone: GodotZoneResource): { w: number; h: number } {
    return {
        w: Math.max(1, Math.round(zone.size.x)),
        h: Math.max(1, Math.round(zone.size.y)),
    };
}

/** Center of the bounding box over all zones, for a sensible default camera frame. */
function worldCenter(zones: GodotZoneResource[]): { x: number; y: number } {
    if (zones.length === 0) return { x: 0, y: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of zones) {
        const { w, h } = zoneExtent(z);
        minX = Math.min(minX, z.position.x);
        minY = Math.min(minY, z.position.y);
        maxX = Math.max(maxX, z.position.x + w);
        maxY = Math.max(maxY, z.position.y + h);
    }
    return { x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) };
}

function clampZ(z: number): number {
    return Math.max(Z_INDEX_MIN, Math.min(Z_INDEX_MAX, z));
}

function sanitize(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

function escapeGodot(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
