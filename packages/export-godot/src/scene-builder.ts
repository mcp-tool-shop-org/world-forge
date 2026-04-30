/**
 * scene-builder.ts — Compose converted data into Godot .tscn text format.
 *
 * Generates valid Godot 4 scene files that can be opened directly in the editor.
 * Format reference: https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html
 *
 * Scene tree structure:
 *   World (Node2D)
 *   ├── <ZoneName> (Node2D) — positioned at zone origin
 *   │   ├── Entities/ (Node2D)
 *   │   │   ├── <EntityName> (Node2D) — instance of scene template
 *   │   │   └── ...
 *   │   ├── Items/ (Node2D)
 *   │   │   ├── <ItemName> (Node2D)
 *   │   │   └── ...
 *   │   ├── SpawnPoints/ (Node2D)
 *   │   │   └── <SpawnName> (Marker2D)
 *   │   └── Transitions/ (Node2D)
 *   │       └── <TransitionName> (Area2D)
 *   └── ...
 */

import type { GodotZoneResource } from './convert-zones.js';
import type { GodotEntityManifest } from './convert-entities.js';
import type { GodotItemResource } from './convert-items.js';
import type { GodotNavigationLink } from './convert-connections.js';
import type { GodotSpawnMarker } from './convert-spawn-points.js';
import type { GodotTransitionNode } from './convert-transitions.js';

export interface SceneBuildInput {
    projectName: string;
    zones: GodotZoneResource[];
    entities: GodotEntityManifest;
    items: GodotItemResource[];
    navigationLinks: GodotNavigationLink[];
    spawnMarkers: GodotSpawnMarker[];
    transitions: GodotTransitionNode[];
}

/**
 * Build the main world .tscn file content (Godot 4 text scene format).
 * This produces a single scene file with all zones as child nodes.
 */
export function buildWorldScene(input: SceneBuildInput): string {
    const lines: string[] = [];
    // External resources (scene templates referenced by entities/transitions).
    const extResources = collectExtResources(input);

    // Header
    lines.push(`[gd_scene load_steps=${extResources.length + 1} format=3 uid="uid://world_forge_export"]`);
    lines.push('');

    // External resource declarations
    for (let i = 0; i < extResources.length; i++) {
        lines.push(`[ext_resource type="PackedScene" uid="uid://ext_${i}" path="${extResources[i].path}" id="${extResources[i].id}"]`);
    }
    if (extResources.length > 0) lines.push('');

    // Root node
    lines.push(`[node name="${sanitize(input.projectName)}" type="Node2D"]`);
    lines.push('');

    // Zone nodes
    for (const zone of input.zones) {
        lines.push(`[node name="${zone.nodeName}" type="Node2D" parent="."]`);
        lines.push(`position = Vector2(${zone.position.x}, ${zone.position.y})`);
        lines.push(`metadata/zone_id = "${zone.id}"`);
        lines.push(`metadata/description = "${escapeGodot(zone.description)}"`);
        lines.push(`metadata/light = ${zone.light}`);
        lines.push(`metadata/noise = ${zone.noise}`);
        if (zone.elevation !== undefined) lines.push(`metadata/elevation = ${zone.elevation}`);
        if (zone.parentDistrictId) lines.push(`metadata/district_id = "${zone.parentDistrictId}"`);
        lines.push('');

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

function sanitize(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

function escapeGodot(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
