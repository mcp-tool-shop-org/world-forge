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
 *   │   ├── Collision (StaticBody2D) — only when collisionType is void/hazard
 *   │   │   └── CollisionShape2D — RectangleShape2D covering the zone bounds
 *   │   ├── Navigation (NavigationRegion2D) — rectangular NavigationPolygon
 *   │   ├── Entities/ (Node2D)
 *   │   │   └── <EntityName> (Node2D) — textureless placeholder; sceneTemplate in metadata
 *   │   ├── Items/ (Node2D)
 *   │   ├── SpawnPoints/ (Node2D)
 *   │   │   └── <SpawnName> (Marker2D)
 *   │   └── Transitions/ (Node2D)
 *   │       └── <TransitionName> (Area2D + CollisionShape2D trigger)
 *   └── NavigationLinks/ (Node2D)
 *
 * Wave B-1: the scene ships a playable scaffold — per-cell wall collision,
 * per-zone navigation regions, a framed Camera2D, and 2.5D y-sort / z-index — so
 * a world-forge export opens in Godot as a navigable, collidable, visible scene
 * rather than a metadata-only graph. Walkable interiors are not filled with a
 * zone AABB StaticBody2D (that blocked CharacterBody2D while navmesh said walk).
 */

import type { GodotZoneResource } from './convert-zones.js';
import type { GodotEntityManifest } from './convert-entities.js';
import type { GodotItemResource } from './convert-items.js';
import type { GodotNavigationLink } from './convert-connections.js';
import type { GodotSpawnMarker } from './convert-spawn-points.js';
import type { GodotTransitionNode } from './convert-transitions.js';
import { encodeTileMapData, type GodotTileLayer } from './convert-tile-layers.js';
import type { GodotPropNode } from './convert-props.js';
import type { GodotMarketNode, GodotCraftingStation } from './convert-economy.js';
import type { GodotBuilding, GodotHub, GodotStronghold } from './convert-structures.js';
import type { GodotStratum, GodotStratumLink } from './convert-strata.js';
import type { GodotHazardPlacement } from './convert-hazards.js';
import type { GodotZoneGate } from './convert-gates.js';
import { sanitizeNodeName } from './node-naming.js';
import { DEFAULT_TILE_SIZE_PX } from './coordinate-transform.js';
import type { FidelityEntry } from './fidelity.js';

/** Root-level siblings that must not collide with zone / tile-layer node names. */
export const RESERVED_ROOT_NODE_NAMES = [
    'Camera2D',
    'Props',
    'Markets',
    'CraftingStations',
    'Buildings',
    'Hubs',
    'Strongholds',
    'Strata',
    'StratumLinks',
    'Hazards',
    'NavigationLinks',
] as const;

export interface SceneBuildInput {
    projectName: string;
    /** Source project.id — used to derive a per-world scene uid. */
    projectId?: string;
    /** Optional uid prefix (default `wf`). */
    sceneUidPrefix?: string;
    /** Project map.tileSize; sizes TransitionShape. Defaults to DEFAULT_TILE_SIZE_PX. */
    tileSize?: number;
    /** Sink for root-name collision fidelity (mutated when provided). */
    fidelity?: FidelityEntry[];
    zones: GodotZoneResource[];
    entities: GodotEntityManifest;
    items: GodotItemResource[];
    navigationLinks: GodotNavigationLink[];
    spawnMarkers: GodotSpawnMarker[];
    transitions: GodotTransitionNode[];
    /** Tile layers → TileMapLayer nodes. Optional for back-compat with older callers. */
    tileLayers?: GodotTileLayer[];
    /** Prop placements → Node2D placeholders under a "Props" container. Optional. */
    props?: GodotPropNode[];
    /** Market nodes → Node2D under a "Markets" container (at zone centers). Optional. */
    markets?: GodotMarketNode[];
    /** Crafting stations → Node2D under a "CraftingStations" container. Optional. */
    craftingStations?: GodotCraftingStation[];
    /** Buildings → StaticBody2D footprints under a "Buildings" container. Optional. */
    buildings?: GodotBuilding[];
    /** Hubs → Node2D under a "Hubs" container (at zone centers). Optional. */
    hubs?: GodotHub[];
    /** Strongholds → Node2D under a "Strongholds" container (at zone centers). Optional. */
    strongholds?: GodotStronghold[];
    /** Vertical strata → Node2D under a "Strata" container (metadata). Optional. */
    strata?: GodotStratum[];
    /** Inter-stratum connectors → Node2D under a "StratumLinks" container. Optional. */
    stratumLinks?: GodotStratumLink[];
    /** zoneId → its stratum (id + z band) for stratum_id metadata + z_index banding. Optional. */
    zoneStrata?: Record<string, { stratumId: string; zBand: number }>;
    /** Hazard placements → Area2D regions under a "Hazards" container. Optional. */
    hazards?: GodotHazardPlacement[];
    /** zoneId → its entry gate, emitted as metadata on the zone node. Optional. */
    zoneGates?: Record<string, GodotZoneGate>;
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
    uniquifyRootNodeNames(input.zones, tileLayers, input.fidelity);
    // Tile resources — TileSet/TileSetAtlasSource sub-resources + tileset textures.
    // Entities/transitions are textureless Node2D / Area2D placeholders (scene
    // templates live in metadata) so a clean Godot project does not need the
    // PackedScenes this pack does not ship.
    const tileResources = collectTileResources(tileLayers);
    // Sub-resources (per-zone navigation polygons + optional void/hazard hulls).
    const subResources = collectSubResources(input.zones);
    // Building footprint collision shapes (one RectangleShape2D per building).
    const buildingShapes = collectBuildingShapes(input.buildings ?? []);
    // Hazard region collision shapes (one RectangleShape2D per hazard placement).
    const hazardShapes = collectHazardShapes(input.hazards ?? []);
    // Shared Area2D trigger shape so fallback transitions fire body_entered.
    const transitionShapes = collectTransitionShapes(
        input.transitions,
        input.tileSize ?? DEFAULT_TILE_SIZE_PX,
    );

    // Header — load_steps counts every ext + sub resource plus the implicit scene step.
    const loadSteps = tileResources.textures.length
        + subResources.blocks.length + tileResources.subBlocks.length
        + buildingShapes.blocks.length + hazardShapes.length
        + transitionShapes.length + 1;
    lines.push(`[gd_scene load_steps=${loadSteps} format=3${sceneUidAttribute(input.projectId, input.sceneUidPrefix)}]`);
    lines.push('');

    // External resource declarations — tileset textures only. PackedScene
    // templates are stored as metadata, matching props, so the scene loads
    // without files this pack does not ship.
    for (const tex of tileResources.textures) {
        lines.push(`[ext_resource type="Texture2D" path=${quoted(tex.path)} id="${tex.id}"]`);
    }
    if (tileResources.textures.length > 0) lines.push('');

    // Sub-resource declarations (must precede the nodes that reference them).
    for (const block of subResources.blocks) {
        lines.push(block);
        lines.push('');
    }
    for (const block of tileResources.subBlocks) {
        lines.push(block);
        lines.push('');
    }
    for (const block of buildingShapes.blocks) {
        lines.push(block);
        lines.push('');
    }
    for (const block of hazardShapes) {
        lines.push(block);
        lines.push('');
    }
    for (const block of transitionShapes) {
        lines.push(block);
        lines.push('');
    }

    // Root node — y-sort enabled so 2.5D depth ordering works out of the box.
    // F-00cf78db: the identical gap convert-zones.ts:116 had — a project name
    // that sanitizes to '' used to produce a scene root itself named "".
    lines.push(`[node name="${sanitizeNodeName(input.projectName) || 'World'}" type="Node2D"]`);
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
    lines.push(...emitTileMapLayers(tileLayers, tileResources.tileSetIdByLayer, tileResources.wallRectIdByLayer));

    // Zone nodes
    for (const zone of input.zones) {
        const ids = subResources.idsByZone.get(zone.id);
        const { w, h } = zoneExtent(zone);

        lines.push(`[node name="${zone.nodeName}" type="Node2D" parent="."]`);
        lines.push(`position = Vector2(${zone.position.x}, ${zone.position.y})`);
        lines.push('y_sort_enabled = true');
        // z_index: a stratum (if any) sets the coarse absolute band so cross-level
        // draw order is correct; elevation refines within the band. Without a
        // stratum we keep the legacy elevation-only behaviour untouched.
        const zoneStratum = input.zoneStrata?.[zone.id];
        const elevZ = zone.elevation !== undefined ? Math.round(zone.elevation) : 0;
        if (zoneStratum) {
            lines.push(`z_index = ${clampZ(zoneStratum.zBand + elevZ)}`);
            lines.push('z_as_relative = false');
        } else if (zone.elevation !== undefined) {
            lines.push(`z_index = ${clampZ(elevZ)}`);
        }
        lines.push(`metadata/zone_id = ${quoted(zone.id)}`);
        if (zoneStratum) lines.push(`metadata/stratum_id = ${quoted(zoneStratum.stratumId)}`);
        lines.push(`metadata/description = ${quoted(zone.description)}`);
        lines.push(`metadata/light = ${zone.light}`);
        lines.push(`metadata/noise = ${zone.noise}`);
        if (zone.elevation !== undefined) lines.push(`metadata/elevation = ${zone.elevation}`);
        if (zone.parentDistrictId) lines.push(`metadata/district_id = ${quoted(zone.parentDistrictId)}`);
        if (zone.collisionType) lines.push(`metadata/collision_type = ${quoted(zone.collisionType)}`);
        if (zone.skylineRef) lines.push(`metadata/skyline_ref = ${quoted(zone.skylineRef)}`);
        if (zone.physicsMode) lines.push(`metadata/physics_mode = ${quoted(zone.physicsMode)}`);
        if (zone.timeOfDay) lines.push(`metadata/time_of_day = ${quoted(zone.timeOfDay)}`);
        if (zone.gravityOverride !== undefined) lines.push(`metadata/gravity_override = ${zone.gravityOverride}`);
        if (zone.gravityDirection) lines.push(`metadata/gravity_direction = ${quoted(zone.gravityDirection)}`);
        if (zone.parallaxLayers && zone.parallaxLayers.length > 0) {
            lines.push(`metadata/parallax_count = ${zone.parallaxLayers.length}`);
            lines.push(`metadata/parallax_layers = ${quoted(JSON.stringify(zone.parallaxLayers))}`);
        }
        // Entry gate — the runtime reads these to allow/deny party entry on contact.
        const gate = input.zoneGates?.[zone.id];
        if (gate) {
            lines.push(`metadata/entry_gate = ${quoted(gate.conditions.join(';'))}`);
            lines.push(`metadata/entry_gate_mode = ${quoted(gate.mode)}`);
            if (gate.reason) lines.push(`metadata/entry_gate_reason = ${quoted(gate.reason)}`);
        }
        lines.push('');

        // Collision — top-down walkable interiors must NOT get a filled AABB
        // StaticBody2D (default layer/mask 1 blocked CharacterBody2D from the
        // walkable interior while NavigationRegion2D said walk). Walls come
        // from per-cell tile collision. Void/hazard honour collisionType with
        // a solid hull covering the extent — not "zone edges".
        if (ids?.rect) {
            lines.push(`[node name="Collision" type="StaticBody2D" parent="${zone.nodeName}"]`);
            lines.push('');
            lines.push(`[node name="CollisionShape2D" type="CollisionShape2D" parent="${zone.nodeName}/Collision"]`);
            lines.push(`position = Vector2(${w / 2}, ${h / 2})`);
            lines.push(`shape = SubResource("${ids.rect}")`);
            lines.push('');
        }

        if (ids) {
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
                // Textureless Node2D placeholder — matching props. sceneTemplate
                // is metadata, not an ExtResource this pack does not ship.
                lines.push(`[node name="${entity.nodeName}" type="Node2D" parent="${zone.nodeName}/Entities"]`);
                lines.push(`position = Vector2(${entity.localPosition.x}, ${entity.localPosition.y})`);
                lines.push(`metadata/entity_id = ${quoted(entity.entityId)}`);
                lines.push(`metadata/role = ${quoted(entity.role)}`);
                if (entity.sceneTemplate) lines.push(`metadata/scene_template = ${quoted(entity.sceneTemplate)}`);
                if (entity.displayName) lines.push(`metadata/display_name = ${quoted(entity.displayName)}`);
                if (entity.factionId) lines.push(`metadata/faction_id = ${quoted(entity.factionId)}`);
                if (entity.dialogueId) lines.push(`metadata/dialogue_id = ${quoted(entity.dialogueId)}`);
                if (entity.spawnCondition) lines.push(`metadata/spawn_condition = ${quoted(entity.spawnCondition)}`);
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
                lines.push(`metadata/item_id = ${quoted(item.itemId)}`);
                if (item.displayName) lines.push(`metadata/display_name = ${quoted(item.displayName)}`);
                lines.push(`metadata/hidden = ${item.hidden}`);
                // slot/rarity/container all route through escapeGodot(), matching
                // display_name two lines above — item.container in particular is
                // authored free text (packages/schema/src/entities.ts declares it
                // `container?: string`, not a closed union like slot/rarity), and a
                // literal '"' in it used to reach this line unescaped.
                if (item.slot) lines.push(`metadata/slot = ${quoted(item.slot)}`);
                if (item.rarity) lines.push(`metadata/rarity = ${quoted(item.rarity)}`);
                if (item.container) lines.push(`metadata/container = ${quoted(item.container)}`);
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
                lines.push(`metadata/spawn_id = ${quoted(sp.id)}`);
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
                // Textureless Area2D placeholder with an inline trigger shape so
                // body_entered fires without a PackedScene this pack does not ship.
                lines.push(`[node name="${tr.nodeName}" type="Area2D" parent="${zone.nodeName}/Transitions"]`);
                lines.push(`position = Vector2(${tr.localPosition.x}, ${tr.localPosition.y})`);
                lines.push(`metadata/transition_id = ${quoted(tr.id)}`);
                lines.push(`metadata/target_zone = ${quoted(tr.targetZoneId)}`);
                lines.push(`metadata/type = ${quoted(tr.type)}`);
                if (tr.sceneTemplate) lines.push(`metadata/scene_template = ${quoted(tr.sceneTemplate)}`);
                if (tr.label) lines.push(`metadata/label = ${quoted(tr.label)}`);
                if (tr.animation) lines.push(`metadata/animation = ${quoted(tr.animation)}`);
                if (tr.durationSeconds !== undefined) lines.push(`metadata/duration = ${tr.durationSeconds}`);
                lines.push('');
                lines.push(`[node name="Trigger" type="CollisionShape2D" parent="${zone.nodeName}/Transitions/${tr.nodeName}"]`);
                lines.push(`shape = SubResource("TransitionShape")`);
                lines.push('');
            }
        }
    }

    // Props — placed furniture/objects as Node2D placeholders under a root
    // "Props" container, carrying definition data as metadata (textureless, so
    // the scene loads with no external deps — the runtime binds the sprite).
    const props = input.props ?? [];
    if (props.length > 0) {
        lines.push(`[node name="Props" type="Node2D" parent="."]`);
        lines.push('');
        for (const p of props) {
            lines.push(`[node name="${p.nodeName}" type="Node2D" parent="Props"]`);
            lines.push(`position = Vector2(${p.position.x}, ${p.position.y})`);
            lines.push(`metadata/prop_id = ${quoted(p.id)}`);
            lines.push(`metadata/prop_def = ${quoted(p.propId)}`);
            if (p.displayName) lines.push(`metadata/display_name = ${quoted(p.displayName)}`);
            lines.push(`metadata/walkable = ${p.walkable}`);
            lines.push(`metadata/interactable = ${p.interactable}`);
            lines.push(`metadata/width = ${p.width}`);
            lines.push(`metadata/height = ${p.height}`);
            if (p.imagePath) lines.push(`metadata/image_path = ${quoted(p.imagePath)}`);
            if (p.zoneId) lines.push(`metadata/zone_id = ${quoted(p.zoneId)}`);
            lines.push('');
        }
    }

    // Town economy — market nodes + crafting stations as Node2D placeholders at
    // their zone centers, with economic data as metadata (the runtime drives
    // shop/crafting behavior from these + the content pack).
    const markets = input.markets ?? [];
    if (markets.length > 0) {
        lines.push(`[node name="Markets" type="Node2D" parent="."]`);
        lines.push('');
        for (const m of markets) {
            lines.push(`[node name="${m.nodeName}" type="Node2D" parent="Markets"]`);
            lines.push(`position = Vector2(${m.position.x}, ${m.position.y})`);
            lines.push(`metadata/market_id = ${quoted(m.id)}`);
            lines.push(`metadata/zone_id = ${quoted(m.zoneId)}`);
            lines.push(`metadata/supply_categories = ${quoted(m.supplyCategories.join(','))}`);
            lines.push(`metadata/price_modifier = ${m.priceModifier}`);
            lines.push(`metadata/contraband = ${m.contrabandAvailable}`);
            if (m.merchantEntityId) lines.push(`metadata/merchant_entity_id = ${quoted(m.merchantEntityId)}`);
            lines.push('');
        }
    }

    const craftingStations = input.craftingStations ?? [];
    if (craftingStations.length > 0) {
        lines.push(`[node name="CraftingStations" type="Node2D" parent="."]`);
        lines.push('');
        for (const c of craftingStations) {
            lines.push(`[node name="${c.nodeName}" type="Node2D" parent="CraftingStations"]`);
            lines.push(`position = Vector2(${c.position.x}, ${c.position.y})`);
            lines.push(`metadata/station_id = ${quoted(c.id)}`);
            lines.push(`metadata/zone_id = ${quoted(c.zoneId)}`);
            lines.push(`metadata/station_type = ${quoted(c.stationType)}`);
            lines.push(`metadata/recipes = ${quoted(c.availableRecipes.join(','))}`);
            lines.push('');
        }
    }

    // Town structures — buildings export as StaticBody2D footprints (tile-sized
    // collision rect) at their footprint origin; hubs + strongholds export as
    // Node2D placeholders at their zone centers. All carry their data as metadata.
    const buildings = input.buildings ?? [];
    if (buildings.length > 0) {
        lines.push(`[node name="Buildings" type="Node2D" parent="."]`);
        lines.push('');
        for (const b of buildings) {
            const rectId = buildingShapes.rectIdByBuilding.get(b.id);
            lines.push(`[node name="${b.nodeName}" type="StaticBody2D" parent="Buildings"]`);
            lines.push(`position = Vector2(${b.position.x}, ${b.position.y})`);
            lines.push(`metadata/building_id = ${quoted(b.id)}`);
            lines.push(`metadata/name = ${quoted(b.name)}`);
            lines.push(`metadata/building_type = ${quoted(b.buildingType)}`);
            lines.push(`metadata/footprint_tiles = ${quoted(`${b.widthTiles}x${b.heightTiles}`)}`);
            if (b.zoneId) lines.push(`metadata/zone_id = ${quoted(b.zoneId)}`);
            if (b.interiorZoneId) lines.push(`metadata/interior_zone_id = ${quoted(b.interiorZoneId)}`);
            lines.push('');
            if (rectId) {
                lines.push(`[node name="Footprint" type="CollisionShape2D" parent="Buildings/${b.nodeName}"]`);
                lines.push(`position = Vector2(${b.footprint.w / 2}, ${b.footprint.h / 2})`);
                lines.push(`shape = SubResource("${rectId}")`);
                lines.push('');
            }
        }
    }

    const hubs = input.hubs ?? [];
    if (hubs.length > 0) {
        lines.push(`[node name="Hubs" type="Node2D" parent="."]`);
        lines.push('');
        for (const h of hubs) {
            lines.push(`[node name="${h.nodeName}" type="Node2D" parent="Hubs"]`);
            lines.push(`position = Vector2(${h.position.x}, ${h.position.y})`);
            lines.push(`metadata/hub_id = ${quoted(h.id)}`);
            lines.push(`metadata/name = ${quoted(h.name)}`);
            lines.push(`metadata/zone_id = ${quoted(h.zoneId)}`);
            lines.push(`metadata/hub_type = ${quoted(h.hubType)}`);
            lines.push(`metadata/services = ${quoted(h.serviceTypes.join(','))}`);
            lines.push(`metadata/connected_zones = ${quoted(h.connectedZoneIds.join(','))}`);
            lines.push('');
        }
    }

    const strongholds = input.strongholds ?? [];
    if (strongholds.length > 0) {
        lines.push(`[node name="Strongholds" type="Node2D" parent="."]`);
        lines.push('');
        for (const s of strongholds) {
            lines.push(`[node name="${s.nodeName}" type="Node2D" parent="Strongholds"]`);
            lines.push(`position = Vector2(${s.position.x}, ${s.position.y})`);
            lines.push(`metadata/stronghold_id = ${quoted(s.id)}`);
            lines.push(`metadata/name = ${quoted(s.name)}`);
            lines.push(`metadata/zone_id = ${quoted(s.zoneId)}`);
            if (s.factionId) lines.push(`metadata/faction_id = ${quoted(s.factionId)}`);
            lines.push(`metadata/defense_level = ${s.defenseLevel}`);
            lines.push(`metadata/garrison = ${quoted(s.garrisonEntityIds.join(','))}`);
            lines.push('');
        }
    }

    // World modeling — vertical strata + their connectors as Node2D placeholders
    // with metadata. Zones carry stratum_id + a z_index band (emitted above); the
    // runtime drives per-level visibility/navigation from this metadata.
    const strata = input.strata ?? [];
    if (strata.length > 0) {
        lines.push(`[node name="Strata" type="Node2D" parent="."]`);
        lines.push('');
        for (const s of strata) {
            lines.push(`[node name="${s.nodeName}" type="Node2D" parent="Strata"]`);
            lines.push(`metadata/stratum_id = ${quoted(s.id)}`);
            lines.push(`metadata/name = ${quoted(s.name)}`);
            lines.push(`metadata/order = ${s.order}`);
            lines.push(`metadata/z_band = ${s.zBand}`);
            if (s.zRange) {
                lines.push(`metadata/z_floor = ${s.zRange.floor}`);
                lines.push(`metadata/z_ceiling = ${s.zRange.ceiling}`);
            }
            lines.push(`metadata/visible_strata = ${quoted(s.visibleStrata.join(','))}`);
            lines.push('');
        }
    }

    const stratumLinks = input.stratumLinks ?? [];
    if (stratumLinks.length > 0) {
        lines.push(`[node name="StratumLinks" type="Node2D" parent="."]`);
        lines.push('');
        for (const l of stratumLinks) {
            lines.push(`[node name="${l.nodeName}" type="Node2D" parent="StratumLinks"]`);
            lines.push(`position = Vector2(${l.position.x}, ${l.position.y})`);
            lines.push(`metadata/link_id = ${quoted(l.id)}`);
            lines.push(`metadata/from_stratum = ${quoted(l.fromStratumId)}`);
            lines.push(`metadata/to_stratum = ${quoted(l.toStratumId)}`);
            if (l.fromZoneId) lines.push(`metadata/from_zone = ${quoted(l.fromZoneId)}`);
            if (l.toZoneId) lines.push(`metadata/to_zone = ${quoted(l.toZoneId)}`);
            lines.push(`metadata/bidirectional = ${l.bidirectional}`);
            lines.push(`metadata/link_type = ${quoted(l.linkType)}`);
            lines.push('');
        }
    }

    // Typed hazards — one Area2D per (zone, hazard) covering the zone, with an
    // inline zone-sized CollisionShape2D and the hazard data as metadata. The
    // runtime applies effects on body_entered from the metadata.
    const hazards = input.hazards ?? [];
    if (hazards.length > 0) {
        lines.push(`[node name="Hazards" type="Node2D" parent="."]`);
        lines.push('');
        for (let i = 0; i < hazards.length; i++) {
            const hz = hazards[i];
            lines.push(`[node name="${hz.nodeName}" type="Area2D" parent="Hazards"]`);
            lines.push(`position = Vector2(${hz.position.x}, ${hz.position.y})`);
            lines.push(`metadata/hazard_id = ${quoted(hz.hazardId)}`);
            lines.push(`metadata/zone_id = ${quoted(hz.zoneId)}`);
            lines.push(`metadata/trigger = ${quoted(hz.trigger)}`);
            lines.push(`metadata/move_cost_delta = ${hz.moveCostDelta}`);
            lines.push(`metadata/passable = ${quoted(hz.passable)}`);
            lines.push(`metadata/blocks_vision = ${hz.blocksVision}`);
            lines.push(`metadata/effect_count = ${hz.effectCount}`);
            lines.push(`metadata/effects = ${quoted(hz.effects)}`);
            if (hz.name) lines.push(`metadata/name = ${quoted(hz.name)}`);
            if (hz.tags && hz.tags.length > 0) lines.push(`metadata/tags = ${quoted(hz.tags.join(','))}`);
            if (hz.weatherConditions && hz.weatherConditions.length > 0) {
                lines.push(`metadata/weather_conditions = ${quoted(hz.weatherConditions.join(','))}`);
            }
            if (hz.immuneTags && hz.immuneTags.length > 0) {
                lines.push(`metadata/immune_tags = ${quoted(hz.immuneTags.join(','))}`);
            }
            lines.push('');
            lines.push(`[node name="Region" type="CollisionShape2D" parent="Hazards/${hz.nodeName}"]`);
            lines.push(`shape = SubResource("HazardShape_${i}")`);
            lines.push('');
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
            lines.push(`metadata/from_zone = ${quoted(link.fromZoneId)}`);
            lines.push(`metadata/to_zone = ${quoted(link.toZoneId)}`);
            lines.push(`metadata/kind = ${quoted(link.kind)}`);
            lines.push(`metadata/transition_mode = ${quoted(link.transitionMode)}`);
            if (link.label) lines.push(`metadata/label = ${quoted(link.label)}`);
            if (link.condition) lines.push(`metadata/condition = ${quoted(link.condition)}`);
            lines.push('');
        }
    }

    return assertParseable(lines.join('\n'));
}

/**
 * A `[node ...]` header must fully tokenize as `[node` + one-or-more
 * space-separated `key="value"` / `key=Bareword(args)` attributes + `]`.
 * Godot's tag-header parser shares the same string-literal grammar as an
 * ordinary `key = value` property line, so a value cannot itself contain a
 * raw, unescaped `"` — that would end the string early and desync the rest
 * of the tag. This regex is deliberately a full-line, anchored tokenizer
 * (not a substring search): `[node name="Big_"Boss"_Tony" type="Node2D"
 * parent="."]` has six quotes, evenly balanced, and would pass any check
 * that merely counts them — it does NOT pass this one, because after the
 * `name=` value is forced to close at the first unescaped `"` (matching
 * only `"Big_"`), the remaining `Boss"_Tony" type="Node2D" parent="."`
 * cannot tokenize as further ` key="value"` attributes followed by `]`.
 */
const NODE_HEADER_RE = /^\[node(?: [A-Za-z_][A-Za-z0-9_]*=(?:"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*\([^()]*\)))+\]$/;

/**
 * Matches one `key="value"` attribute inside a `[node ...]` header line. Used
 * ONLY after NODE_HEADER_RE has already accepted the line as well-formed — it
 * narrows *which* well-formed headers are still unsafe to load, it does not
 * re-decide well-formedness. See the THIRD defect class in assertParseable's
 * doc comment below (F-00cf78db): a zero-length quoted value is syntactically
 * legal to NODE_HEADER_RE but semantically catastrophic to the real engine.
 */
const NODE_ATTR_RE = /([A-Za-z_][A-Za-z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

/**
 * Refuse to return a scene Godot cannot parse.
 *
 * ⚠ MEASURED, not defensive programming. `metadata/hidden = ${item.hidden}` was
 * emitted unguarded, and for a world that omitted that field the exporter produced
 * a `.tscn` containing the literal token `undefined`. Godot's answer is
 * `Parse Error ... [Resource file res://…world.tscn:85]` and a total refusal to load
 * the scene — so an export that reported `success: true` produced a file no engine
 * could open. The 36-assertion engine smoke never caught it because its proof world
 * happens to author every field it touches.
 *
 * A JS template literal turns `undefined`, `null`, `NaN`, `Infinity` and
 * `-Infinity` into tokens that look like values, and there is no shape of
 * authored input for which any of them is a correct thing to write. So
 * rather than guard the sites one at a time and miss one — which is exactly
 * what happened here, and again in the fixture generator's own count — the
 * assembled text is checked once at the only place it can escape.
 *
 * A SECOND, structurally different defect class lives one level up: an
 * unescaped `"` inside a node NAME (as opposed to a bare token as a property
 * VALUE) corrupts a `[node name="..."]` tag header without ever producing a
 * bare undefined/null/NaN/Infinity token — the bare-token regex above cannot
 * see it, by construction, no matter how it is extended. Every node name
 * reaching this function is expected to have already gone through
 * `sanitizeNodeName()` (node-naming.ts), which strips the character that
 * causes this; the check here is the backstop for anything that reaches
 * `buildWorldScene` without going through that sanitizer.
 *
 * A THIRD defect class (F-00cf78db) is a well-formed header that is still
 * unsafe: `name=""` / `parent=""` — a zero-length quoted attribute value —
 * tokenizes as perfectly legal to NODE_HEADER_RE (it never claimed to reject
 * an empty string, only an unescaped one), so neither check above fires.
 * Godot's response to it is not a parse error: `parent=""` crashes the real
 * engine outright (`CrashHandlerException: Program crashed with signal 11`,
 * verified against the real, installed Godot 4.7.stable engine) inside its
 * own resource loader, before any script runs — strictly worse than the
 * "refuses to load" failure mode the other two checks guard against. Every
 * name/parent value reaching this function is expected to have already gone
 * through a sanitizer with a non-empty fallback (e.g. `sanitizeNodeName(x) ||
 * 'Node'`, the pattern every converter in this package uses); this is the
 * backstop for anything that reaches `buildWorldScene` without one.
 *
 * Throwing is the right failure: `exportToGodot` catches converter throws and returns
 * a structured `{ success: false, errors }`, so the caller gets a named refusal
 * instead of a broken file.
 */
function assertParseable(scene: string): string {
    const bareTokenOffenders: string[] = [];
    const malformedHeaderOffenders: string[] = [];
    const emptyAttrOffenders: string[] = [];
    const malformedQuotedOffenders: string[] = [];
    const lines = scene.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only the VALUE side: the words are legal inside a quoted string, and a zone
        // legitimately named "The Undefined Berth" must not trip this.
        if (/=\s*(undefined|null|NaN|-?Infinity)\s*$/.test(line)) {
            bareTokenOffenders.push(`line ${i + 1}: ${line}`);
            continue;
        }
        // Property lines whose first value token is a quoted string must be a
        // well-formed Godot string literal (escapes allowed; raw " is not).
        if (/^[A-Za-z_][\w/]*\s*=\s*"/.test(line) && !/^[A-Za-z_][\w/]*\s*=\s*"(?:[^"\\]|\\.)*"\s*$/.test(line)) {
            malformedQuotedOffenders.push(`line ${i + 1}: ${line}`);
            continue;
        }
        if (line.startsWith('[node ')) {
            if (!NODE_HEADER_RE.test(line)) {
                malformedHeaderOffenders.push(`line ${i + 1}: ${line}`);
            } else {
                // Well-formed per NODE_HEADER_RE, but name="" / parent="" is a
                // distinct, semantically fatal defect that tokenizer accepts
                // (see the THIRD defect class above) — check each attribute
                // value the header actually carries.
                NODE_ATTR_RE.lastIndex = 0;
                let attr: RegExpExecArray | null;
                while ((attr = NODE_ATTR_RE.exec(line))) {
                    if ((attr[1] === 'name' || attr[1] === 'parent') && attr[2] === '') {
                        emptyAttrOffenders.push(`line ${i + 1}: ${attr[1]}="" — ${line}`);
                    }
                }
            }
        }
    }
    if (bareTokenOffenders.length > 0) {
        throw new Error(
            `refusing to emit an unparseable scene: ${bareTokenOffenders.length} propert`
            + `${bareTokenOffenders.length === 1 ? 'y' : 'ies'} would be written as a bare `
            + `undefined/null/NaN/Infinity/-Infinity, which Godot rejects with a parse error and a total `
            + `refusal to load the scene.\n  ${bareTokenOffenders.join('\n  ')}\n`
            + '  Fix: author the missing field, or omit the metadata line entirely — '
            + 'a scene missing a key loads fine, a scene containing `undefined` does not.',
        );
    }
    if (malformedHeaderOffenders.length > 0) {
        throw new Error(
            `refusing to emit an unparseable scene: ${malformedHeaderOffenders.length} `
            + `[node ...] header${malformedHeaderOffenders.length === 1 ? '' : 's'} would not parse as a `
            + `well-formed tag — almost always an unescaped '"' inside a node name, which Godot's tag-header `
            + `tokenizer reads as ending the name's value early, desyncing the rest of the tag. Godot rejects `
            + `this with a parse error and a total refusal to load the scene.\n  ${malformedHeaderOffenders.join('\n  ')}\n`
            + '  Fix: the offending name must be produced by sanitizeNodeName() (node-naming.ts) before it '
            + 'reaches buildWorldScene.',
        );
    }
    if (emptyAttrOffenders.length > 0) {
        throw new Error(
            `refusing to emit an unparseable scene: ${emptyAttrOffenders.length} `
            + `[node ...] header${emptyAttrOffenders.length === 1 ? '' : 's'} would carry an empty `
            + `name="" or parent="" value. This is syntactically well-formed — a zero-length quoted `
            + `string is a legal attribute value — so it will NOT be caught as a parse error. Instead, `
            + `Godot's real engine crashes outright loading a parent="" NodePath (CrashHandlerException, `
            + `signal 11, inside its own resource loader, before any script runs) — verified against the `
            + `real, installed Godot 4.7.stable engine — and an empty name="" silently collides two `
            + `sibling nodes into one unreachable pair with zero warning. Both are worse than a parse `
            + `error, which is at least a loud refusal.\n  ${emptyAttrOffenders.join('\n  ')}\n`
            + '  Fix: the offending value must come from a sanitizer with a non-empty fallback '
            + "(sanitizeNodeName(x) || 'Node' or similar, the pattern every converter in this package "
            + 'uses) before it reaches buildWorldScene.',
        );
    }
    if (malformedQuotedOffenders.length > 0) {
        throw new Error(
            `refusing to emit an unparseable scene: ${malformedQuotedOffenders.length} propert`
            + `${malformedQuotedOffenders.length === 1 ? 'y' : 'ies'} would be written as a quoted `
            + `string that is not a well-formed Godot string literal — almost always a raw '"' inside `
            + `metadata (spawn_condition, faction_id, item ids, connection condition) that terminates `
            + `the value early. Godot rejects this with a parse error and a total refusal to load the scene.`
            + `\n  ${malformedQuotedOffenders.join('\n  ')}\n`
            + '  Fix: every quoted property interpolation must go through escapeGodot() (quoted()) '
            + 'before it reaches the assembled .tscn text.',
        );
    }
    return scene;
}

interface TileResourceSet {
    /** Tileset texture ext_resources (deduped by path). */
    textures: { path: string; id: string }[];
    /** TileSetAtlasSource + TileSet (+ wall-collision Rect) sub-resource blocks, in declaration order. */
    subBlocks: string[];
    /** Map of tile layer id → its TileSet sub-resource id. */
    tileSetIdByLayer: Map<string, string>;
    /** Map of tile layer id → its shared wall-collision RectangleShape2D id (layers with solid cells only). */
    wallRectIdByLayer: Map<string, string>;
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
    const wallRectIdByLayer = new Map<string, string>();

    for (let li = 0; li < tileLayers.length; li++) {
        const layer = tileLayers[li];
        const tileSetId = `TileSet_${li}`;
        tileSetIdByLayer.set(layer.id, tileSetId);

        // Shared tile-sized collision rect for this layer's non-walkable cells.
        if (layer.solidCells.length > 0) {
            const wallRectId = `WallRect_${li}`;
            wallRectIdByLayer.set(layer.id, wallRectId);
            subBlocks.push(
                `[sub_resource type="RectangleShape2D" id="${wallRectId}"]\n` +
                `size = Vector2(${layer.tileSize}, ${layer.tileSize})`,
            );
        }

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

    return { textures, subBlocks, tileSetIdByLayer, wallRectIdByLayer };
}

/** Emit TileMapLayer node blocks (parented to root). Sibling names are deduped. */
function emitTileMapLayers(
    tileLayers: GodotTileLayer[],
    tileSetIdByLayer: Map<string, string>,
    wallRectIdByLayer: Map<string, string>,
): string[] {
    const lines: string[] = [];
    const seen = new Map<string, number>();
    for (const layer of tileLayers) {
        const base = sanitizeNodeName(layer.nodeName) || 'TileLayer';
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
        lines.push(`metadata/layer_id = ${quoted(layer.id)}`);
        lines.push(`metadata/tile_count = ${layer.tileCount}`);
        lines.push(`metadata/image_backed = ${layer.imageBacked}`);
        lines.push(`metadata/solid_count = ${layer.solidCells.length}`);
        lines.push('');

        // Wall collision — a StaticBody2D with one tile-sized CollisionShape2D per
        // non-walkable cell (TileSetAtlasSource physics layers need a texture, so
        // this works for color-only tilesets too). Centered on each cell.
        const wallRectId = wallRectIdByLayer.get(layer.id);
        if (wallRectId && layer.solidCells.length > 0) {
            lines.push(`[node name="Collision" type="StaticBody2D" parent="${nodeName}"]`);
            lines.push('');
            for (let i = 0; i < layer.solidCells.length; i++) {
                const c = layer.solidCells[i];
                const cx = c.gridX * layer.tileSize + layer.tileSize / 2;
                const cy = c.gridY * layer.tileSize + layer.tileSize / 2;
                lines.push(`[node name="WallShape_${i}" type="CollisionShape2D" parent="${nodeName}/Collision"]`);
                lines.push(`position = Vector2(${cx}, ${cy})`);
                lines.push(`shape = SubResource("${wallRectId}")`);
                lines.push('');
            }
        }
    }
    return lines;
}

interface BuildingShapeSet {
    /** RectangleShape2D sub-resource declaration blocks, in declaration order. */
    blocks: string[];
    /** Map of building id → its footprint RectangleShape2D sub-resource id. */
    rectIdByBuilding: Map<string, string>;
}

/**
 * Build one RectangleShape2D sub-resource per building, sized to its pixel
 * footprint. Ids are index-based (BuildingShape_N) so they are always valid
 * Godot SubResource ids regardless of building naming.
 */
function collectBuildingShapes(buildings: GodotBuilding[]): BuildingShapeSet {
    const blocks: string[] = [];
    const rectIdByBuilding = new Map<string, string>();
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        const id = `BuildingShape_${i}`;
        blocks.push(
            `[sub_resource type="RectangleShape2D" id="${id}"]\n` +
            `size = Vector2(${Math.round(b.footprint.w)}, ${Math.round(b.footprint.h)})`,
        );
        rectIdByBuilding.set(b.id, id);
    }
    return { blocks, rectIdByBuilding };
}

/**
 * Build one RectangleShape2D sub-resource per hazard placement, sized to the
 * zone's extent. Ids are index-based (HazardShape_N), matching the index used
 * when emitting the Area2D regions, so references always line up.
 */
function collectHazardShapes(hazards: GodotHazardPlacement[]): string[] {
    const blocks: string[] = [];
    for (let i = 0; i < hazards.length; i++) {
        const hz = hazards[i];
        blocks.push(
            `[sub_resource type="RectangleShape2D" id="HazardShape_${i}"]\n` +
            `size = Vector2(${Math.round(hz.size.w)}, ${Math.round(hz.size.h)})`,
        );
    }
    return blocks;
}

interface SubResourceSet {
    /** Sub-resource declaration blocks, in declaration order. */
    blocks: string[];
    /** Map of zone id → the sub-resource ids that zone's nodes reference. */
    idsByZone: Map<string, { rect?: string; nav: string }>;
}

/** Void/hazard zones are solid; walkable/water/custom interiors stay open. */
function zoneFillsCollision(zone: GodotZoneResource): boolean {
    return zone.collisionType === 'void' || zone.collisionType === 'hazard';
}

/**
 * Build the per-zone navigation-polygon (and, for void/hazard, filled-hull)
 * sub-resources. Ids are index-based (RectShape_N / NavPoly_N) so they are
 * always valid Godot SubResource ids regardless of zone naming.
 */
function collectSubResources(zones: GodotZoneResource[]): SubResourceSet {
    const blocks: string[] = [];
    const idsByZone = new Map<string, { rect?: string; nav: string }>();

    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        const { w, h } = zoneExtent(zone);
        const nav = `NavPoly_${i}`;
        const ids: { rect?: string; nav: string } = { nav };

        if (zoneFillsCollision(zone)) {
            const rect = `RectShape_${i}`;
            blocks.push(
                `[sub_resource type="RectangleShape2D" id="${rect}"]\n` +
                `size = Vector2(${w}, ${h})`,
            );
            ids.rect = rect;
        }
        // Rectangular navmesh in zone-local space: (0,0) (w,0) (w,h) (0,h).
        blocks.push(
            `[sub_resource type="NavigationPolygon" id="${nav}"]\n` +
            `vertices = PackedVector2Array(0, 0, ${w}, 0, ${w}, ${h}, 0, ${h})\n` +
            `polygons = [PackedInt32Array(0, 1, 2, 3)]`,
        );

        idsByZone.set(zone.id, ids);
    }

    return { blocks, idsByZone };
}

/**
 * One shared tile-sized RectangleShape2D for every transition Area2D trigger.
 * Without a CollisionShape2D, Godot Area2D never fires body_entered.
 */
function collectTransitionShapes(transitions: GodotTransitionNode[], tileSize: number = DEFAULT_TILE_SIZE_PX): string[] {
    if (transitions.length === 0) return [];
    const size = tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE_PX;
    return [
        `[sub_resource type="RectangleShape2D" id="TransitionShape"]\n` +
        `size = Vector2(${size}, ${size})`,
    ];
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

function escapeGodot(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Quoted Godot string literal; every property interpolation must go through this. */
function quoted(s: string): string {
    return `"${escapeGodot(s)}"`;
}

function sceneUidAttribute(projectId: string | undefined, prefix: string | undefined): string {
    const id = (projectId ?? '').trim();
    if (!id) return '';
    const token = `${prefix || 'wf'}_${sanitizeNodeName(id).toLowerCase()}`;
    return ` uid="uid://${token}"`;
}

/**
 * De-dupe tile-layer and zone node names against each other and the reserved
 * root containers (Camera2D, Props, Hazards, …). Mutates `nodeName` in place.
 */
export function uniquifyRootNodeNames(
    zones: GodotZoneResource[],
    tileLayers: GodotTileLayer[],
    fidelity?: FidelityEntry[],
): void {
    const seen = new Map<string, number>();
    const owner = new Map<string, string>();
    for (const name of RESERVED_ROOT_NODE_NAMES) {
        seen.set(name, 1);
        owner.set(name, `reserved:${name}`);
    }

    const take = (base: string, fallback: string, kind: 'tile-layer' | 'zone', id: string): string => {
        const safe = sanitizeNodeName(base) || fallback;
        let candidate = safe;
        let suffix = 1;
        while ((seen.get(candidate) ?? 0) > 0) {
            suffix++;
            candidate = `${safe}_${suffix}`;
        }
        seen.set(candidate, 1);
        if (candidate !== safe) {
            const collidedWith = owner.get(safe) ?? safe;
            fidelity?.push({
                level: 'approximated',
                domain: kind === 'tile-layer' ? 'tiles' : 'zones',
                severity: 'warning',
                entityId: id,
                fieldPath: kind === 'tile-layer' ? `tileLayers.${id}.name` : `zones.${id}.name`,
                message: `${kind} "${id}" node name "${safe}" collided with ${collidedWith} — renamed to "${candidate}" so both remain reachable in the scene tree.`,
                reason: 'Root-level Godot siblings (zones, tile layers, and reserved containers) share one name namespace; scene deserialization does not auto-uniquify colliding names.',
            });
        }
        owner.set(candidate, `${kind}:${id}`);
        return candidate;
    };

    for (const layer of tileLayers) {
        layer.nodeName = take(layer.nodeName || layer.name || layer.id, 'TileLayer', 'tile-layer', layer.id);
    }
    for (const zone of zones) {
        zone.nodeName = take(zone.nodeName || zone.displayName || zone.id, 'Zone', 'zone', zone.id);
    }
}
