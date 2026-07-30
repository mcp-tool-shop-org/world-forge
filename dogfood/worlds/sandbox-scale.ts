// sandbox-scale.ts — grow an authored world to a buildable size, in one knob.
//
// WHY THIS EXISTS. Salt Road was authored at 40×28 tiles of 32px with rooms of
// 6×5 — about three character-widths across. It was sized to prove a content
// path, and it reads as a set of closets. To build a town in it, the space has
// to be a town's size.
//
// THE NUMBERS ARE RESEARCHED, NOT PICKED (2026-07-30, two research lanes):
//
//   * Town scale — Stardew Valley's largest vanilla map (Town) is 120×120
//     tiles, and RPG Maker's screen unit is 17×13 tiles; a town of this tier is
//     ~100–140 tiles square broken into 3–5 named sub-areas.
//     https://stardewmodding.wiki.gg/wiki/So_You_Want_To_Be_a_Map_Modder:_Preparations
//   * Tile size — 48–64px is the painterly (non-pixel-art) band; author at 2×
//     and ship at 1×. 32px is a pixel-art size and too small to carry painted
//     detail. https://freegamesprites.com/en/news/tile-size-2d-game-pixel-art-guide
//   * Characters stand 2–3 tiles tall in that band, which is what sets the
//     stage-side CHARACTER_SCALE against a 48px tile.
//
// WHY A TRANSFORM RATHER THAN RE-TYPING THE COORDINATES. Sixty hand-edited
// numbers is sixty chances to put a door inside a wall, and the authored
// numbers are readable as a composition — the quay IS three times the counting
// house. Scaling is arithmetic, so it belongs in arithmetic. One knob, one
// place to change when the next measurement says something different.
//
// WHAT IT DELIBERATELY DOES NOT TOUCH: prose, ids, tags, neighbours, gates,
// hazards, descriptors — everything the Director froze. This function moves
// geometry and nothing else.

import type { WorldProject } from '@world-forge/schema';

/** Linear multiplier on every grid dimension. 40×28 → 120×84 at SCALE 3. */
export const SANDBOX_SCALE = 3;

/** Painterly band (see header). The authored world used 32 — a pixel-art size. */
export const SANDBOX_TILE_SIZE = 48;

const s = (n: number): number => Math.round(n * SANDBOX_SCALE);

/**
 * Grow a world's geometry to buildable size.
 *
 * Pure: returns a new project and mutates nothing, so the authored module stays
 * the single source of the composition and any caller can still export the
 * original for comparison.
 */
export function scaleForSandbox(project: WorldProject): WorldProject {
    // Structural rather than per-type: every one of these domains carries the
    // same four optional grid fields, and enumerating them per interface would
    // be six near-identical functions that drift apart the first time one of the
    // schemas grows a field.
    const grid = <T extends object>(o: T): T => {
        const out: Record<string, unknown> = { ...(o as Record<string, unknown>) };
        for (const key of ['gridX', 'gridY', 'gridWidth', 'gridHeight']) {
            if (typeof out[key] === 'number') out[key] = s(out[key] as number);
        }
        return out as T;
    };

    return {
        ...project,
        map: {
            ...project.map,
            gridWidth: s(project.map.gridWidth),
            gridHeight: s(project.map.gridHeight),
            tileSize: SANDBOX_TILE_SIZE,
        },
        zones: project.zones.map(grid),
        landmarks: project.landmarks.map(grid),
        entityPlacements: project.entityPlacements.map(grid),
        itemPlacements: project.itemPlacements.map(grid),
        spawnPoints: project.spawnPoints.map(grid),
        craftingStations: project.craftingStations.map(grid),
        marketNodes: project.marketNodes.map(grid),
        buildings: (project.buildings ?? []).map(grid),
        propPlacements: project.propPlacements.map(grid),
        tileLayers: project.tileLayers.map((layer) => ({
            ...layer,
            // Tile placements are grid CELLS, so they scale by replication, not
            // by multiplication: each authored cell becomes an S×S block.
            // Multiplying the coordinate alone would spread a painted quay into a
            // scatter of lonely tiles in a floor nine times its old area.
            tiles: layer.tiles.flatMap((p) => {
                const cells: typeof p[] = [];
                for (let dx = 0; dx < SANDBOX_SCALE; dx++) {
                    for (let dy = 0; dy < SANDBOX_SCALE; dy++) {
                        cells.push({ ...p, gridX: s(p.gridX) + dx, gridY: s(p.gridY) + dy });
                    }
                }
                return cells;
            }),
        })),
    };
}
