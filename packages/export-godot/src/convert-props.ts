/**
 * convert-props.ts — WorldProject prop placements → Godot scene nodes.
 *
 * Each PropPlacement resolves against its PropDefinition and becomes a Node2D
 * (parented under a root "Props" container) carrying its definition data as
 * metadata. Like the entity scaffold, these are textureless placeholders: the
 * runtime/game binds the actual sprite from `image_path` + the content pack, so
 * the exported scene loads in Godot with zero external texture dependencies.
 *
 * Orphan placements (propId not in any definition) are dropped with a warning.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

export interface GodotPropNode {
    /** Sanitized, unique node name. */
    nodeName: string;
    /** Placement instance id. */
    id: string;
    /** Definition id. */
    propId: string;
    displayName: string;
    /** Position in pixels (grid × tileSize). */
    position: GodotVec2;
    /** Footprint in tiles. */
    width: number;
    height: number;
    walkable: boolean;
    interactable: boolean;
    imagePath?: string;
    zoneId?: string;
}

export interface ConvertPropsResult {
    props: GodotPropNode[];
    fidelity: FidelityEntry[];
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

export function convertProps(project: WorldProject): ConvertPropsResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const defs = new Map((project.props ?? []).map((p) => [p.id, p]));

    const props: GodotPropNode[] = [];
    const seenNames = new Map<string, number>();
    let dropped = 0;

    for (const pl of project.propPlacements ?? []) {
        const def = defs.get(pl.propId);
        if (!def) {
            dropped++;
            continue;
        }
        // Unique sibling node name within the Props container.
        const base = sanitizeNodeName(def.name || pl.propId) || 'Prop';
        const n = seenNames.get(base) ?? 0;
        seenNames.set(base, n + 1);
        const nodeName = n === 0 ? base : `${base}_${n + 1}`;

        props.push({
            nodeName,
            id: pl.id,
            propId: pl.propId,
            displayName: def.name,
            position: gridToGodot2D(pl.gridX, pl.gridY, tileSize),
            width: def.width,
            height: def.height,
            walkable: def.walkable,
            interactable: def.interactable,
            imagePath: def.imagePath,
            zoneId: pl.zoneId,
        });
    }

    if (dropped > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'props',
            severity: 'warning',
            fieldPath: 'propPlacements',
            message: `${dropped} prop placement(s) reference a propId with no matching definition — dropped.`,
            reason: 'A PropPlacement.propId did not resolve to a PropDefinition; the node cannot be emitted.',
        });
    }
    if (props.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'props',
            severity: 'info',
            fieldPath: 'propPlacements',
            message: `${props.length} prop(s) exported as Node2D placeholders + metadata; the runtime binds sprites from image_path + the content pack.`,
            reason: 'Props ship as textureless scaffold nodes (like entities); sprite/collision binding is a runtime/enhancement step.',
        });
    }

    return { props, fidelity };
}
