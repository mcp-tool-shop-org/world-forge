/**
 * convert-strata.ts — WorldProject vertical strata → Godot scene data.
 *
 * Strata are discrete vertical layers (surface / underground / sky). They export
 * as a "Strata" container of Node2D placeholders carrying each layer's data as
 * metadata, plus a "StratumLinks" container for the inter-level connectors. The
 * load-bearing render effect is the per-zone z_index BAND: a zone in a stratum of
 * `order` draws in band `order * STRATUM_Z_BAND`, so surface zones sort over the
 * cellar regardless of within-zone elevation. (Godot research: z_index is ignored
 * once y-sort is on *within* a layer, so cross-level order must come from a coarse
 * absolute z band on the sibling subtrees — see docs/world-modeling-design.md.)
 *
 * Link positions are the midpoint of their anchor zones when both are set, else
 * the single anchor zone's center, else the world origin.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

/** z_index units between adjacent strata. order=-1 → -100, order=+1 → +100. */
export const STRATUM_Z_BAND = 100;

export interface GodotStratum {
    nodeName: string;
    id: string;
    name: string;
    order: number;
    /** order * STRATUM_Z_BAND — the absolute z band zones in this stratum sort into. */
    zBand: number;
    zRange?: { floor: number; ceiling: number };
    visibleStrata: string[];
}

export interface GodotStratumLink {
    nodeName: string;
    id: string;
    fromStratumId: string;
    toStratumId: string;
    fromZoneId?: string;
    toZoneId?: string;
    bidirectional: boolean;
    linkType: string;
    position: GodotVec2;
}

export interface ConvertStrataResult {
    strata: GodotStratum[];
    links: GodotStratumLink[];
    /** zoneId → its stratum (id + z band) for stratum_id metadata + z_index banding on zone nodes. */
    zoneStrata: Record<string, { stratumId: string; zBand: number }>;
    fidelity: FidelityEntry[];
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

export function convertStrata(project: WorldProject): ConvertStrataResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const strataIn = project.strata ?? [];
    const linksIn = project.stratumLinks ?? [];

    // Zone-center lookup (pixels) for positioning links by their anchor zones.
    const zoneCenter = new Map<string, GodotVec2>();
    for (const z of project.zones) {
        zoneCenter.set(z.id, {
            x: (z.gridX + z.gridWidth / 2) * tileSize,
            y: (z.gridY + z.gridHeight / 2) * tileSize,
        });
    }

    const seen = new Map<string, number>();
    const uniqueName = (base: string): string => {
        const safe = sanitizeNodeName(base) || 'Node';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        return n === 0 ? safe : `${safe}_${n + 1}`;
    };

    const bandById = new Map<string, number>();
    const strata: GodotStratum[] = strataIn.map((s) => {
        const zBand = s.order * STRATUM_Z_BAND;
        bandById.set(s.id, zBand);
        return {
            nodeName: uniqueName(`Stratum_${s.id}`),
            id: s.id,
            name: s.name,
            order: s.order,
            zBand,
            zRange: s.zRange,
            visibleStrata: (s.visibleStrata ?? []).slice(),
        };
    });

    const links: GodotStratumLink[] = linksIn.map((l) => {
        const from = l.fromZoneId ? zoneCenter.get(l.fromZoneId) : undefined;
        const to = l.toZoneId ? zoneCenter.get(l.toZoneId) : undefined;
        let position: GodotVec2 = { x: 0, y: 0 };
        if (from && to) position = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        else if (from) position = from;
        else if (to) position = to;
        return {
            nodeName: uniqueName(`StratumLink_${l.id}`),
            id: l.id,
            fromStratumId: l.fromStratumId,
            toStratumId: l.toStratumId,
            fromZoneId: l.fromZoneId,
            toZoneId: l.toZoneId,
            bidirectional: l.bidirectional,
            linkType: l.linkType,
            position,
        };
    });

    // zoneId → stratum, for z-band + metadata on the zone nodes. Only zones whose
    // stratumId resolves to a real stratum are banded.
    const zoneStrata: Record<string, { stratumId: string; zBand: number }> = {};
    let zonesWithMissingStratum = 0;
    for (const z of project.zones) {
        if (z.stratumId === undefined) continue;
        const band = bandById.get(z.stratumId);
        if (band === undefined) {
            zonesWithMissingStratum++;
            continue;
        }
        zoneStrata[z.id] = { stratumId: z.stratumId, zBand: band };
    }

    if (zonesWithMissingStratum > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'structures',
            severity: 'warning',
            fieldPath: 'zones.stratumId',
            message: `${zonesWithMissingStratum} zone(s) reference a stratumId with no matching stratum — not banded.`,
            reason: 'A zone could not be assigned to a vertical layer because its stratum was not found.',
        });
    }
    if (strata.length + links.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'strata/stratumLinks',
            message: `${strata.length} stratum/strata + ${links.length} link(s) exported as Node2D placeholders with metadata; zones in a stratum get a z_index band (order × ${STRATUM_Z_BAND}) so layers sort correctly.`,
            reason: 'Strata are a discrete vertical layering; the runtime drives per-level visibility/navigation from the metadata, while the z band gives correct cross-level draw order at load.',
        });
    }

    return { strata, links, zoneStrata, fidelity };
}
