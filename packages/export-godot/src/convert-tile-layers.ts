/**
 * convert-tile-layers.ts — WorldProject tile layers → Godot TileMapLayer entries.
 *
 * Each `TileLayer` becomes one `TileMapLayer` node backed by a `TileSet`:
 *  - Image-backed tilesets (with an imagePath) export a `TileSetAtlasSource`
 *    referencing the tileset texture, and the layer's placements are baked into
 *    `tile_map_data` cells (atlas coords from each tile's row/col).
 *  - Color-only tilesets (no image) can't form an atlas source, so the layer
 *    records {gridX, gridY, color, opacity} on `cells` (same tag→color table
 *    as editor `fallbackTileColor` / renderer-2d) and the scene paints those
 *    as ColorRect children. pack.json cells match the scene so a loader can
 *    reconstruct the grid. This mirrors the editor's image-vs-colored-fallback
 *    pixels, not just the branch.
 *
 * Unknown tile ids (not in any tileset) are dropped with a fidelity warning.
 */

import type { WorldProject } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import { resolveTileSize } from './coordinate-transform.js';
import { sanitizeNodeName } from './node-naming.js';
import { deriveGodotFilename } from './convert-assets.js';

/**
 * Editor / renderer-2d tag→color table for tilesets with no imagePath.
 * Precedence: wall > water > door > floor. Keep in lockstep with
 * packages/editor/src/tile-render.ts `fallbackTileColor`.
 */
export function fallbackTileColor(tags: readonly string[]): string {
    if (tags.includes('wall')) return '#555555';
    if (tags.includes('water')) return '#2244aa';
    if (tags.includes('door')) return '#886622';
    return '#333333'; // default floor
}

/** Format a CSS hex + opacity as a Godot 4 `Color(r, g, b, a)` literal. */
export function cssHexToGodotColor(hex: string, opacity: number = 1): string {
    const raw = hex.trim().replace(/^#/, '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const n = Number.parseInt(full, 16);
    const chan = Number.isFinite(n)
        ? [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => v / 255)
        : [0.2, 0.2, 0.2];
    const a = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
    const fmt = (v: number): string => {
        if (v === 0) return '0';
        if (v === 1) return '1';
        return v.toFixed(6).replace(/\.?0+$/, '');
    };
    return `Color(${fmt(chan[0])}, ${fmt(chan[1])}, ${fmt(chan[2])}, ${fmt(a)})`;
}

/** A single baked tile cell — atlas source coords, or a color-only fallback. */
export interface GodotTileCell {
    gridX: number;
    gridY: number;
    /** Index of the atlas source within this layer's TileSet `sources/N`. Unused (0) for color-only. */
    sourceId: number;
    /** Atlas coordinates (column, row) within the source texture. Unused (0) for color-only. */
    atlasX: number;
    atlasY: number;
    /** Tag-derived CSS hex for !imageBacked placements (editor/renderer-2d table). */
    color?: string;
    /** TileDefinition.opacity for color-only placements (0–1). */
    opacity?: number;
}

/** An atlas source for one image-backed tileset used by a layer. */
export interface GodotTileAtlasSource {
    /** Source tileset id (for traceability). */
    tilesetId: string;
    /** Godot resource path for the tileset texture. */
    texturePath: string;
    tileWidth: number;
    tileHeight: number;
    /** `sources/N` index within the layer's TileSet. */
    sourceId: number;
    /** Distinct atlas coords this layer references in the source (for tile defs). */
    atlasCoords: Array<{ atlasX: number; atlasY: number }>;
}

export interface GodotTileLayer {
    /** Sanitized node name for the TileMapLayer. */
    nodeName: string;
    id: string;
    name: string;
    zIndex: number;
    /** Godot TileSet tile size (pixels). */
    tileSize: number;
    /** Atlas sources (one per image-backed tileset referenced by this layer). */
    atlasSources: GodotTileAtlasSource[];
    /** Cells: atlas-backed (tile_map_data) and/or color-only ({color, opacity} → ColorRect). */
    cells: GodotTileCell[];
    /** Grid coords of non-walkable cells — exported as StaticBody2D collision. */
    solidCells: Array<{ gridX: number; gridY: number }>;
    /** Total placements that resolved to a tile (incl. color-only, for metadata). */
    tileCount: number;
    /** True when the layer has at least one atlas source (image-backed). */
    imageBacked: boolean;
}

export interface ConvertTileLayersResult {
    tileLayers: GodotTileLayer[];
    fidelity: FidelityEntry[];
}

/** Godot import convention for a tileset texture — same basename rule as convert-assets. */
function texturePathFor(tilesetId: string, imagePath: string): string {
    return `res://assets/tilesets/${deriveGodotFilename(tilesetId, imagePath)}`;
}

export function convertTileLayers(project: WorldProject): ConvertTileLayersResult {
    const tileSize = resolveTileSize(project);
    const fidelity: FidelityEntry[] = [];

    const tilesets = project.tilesets ?? [];
    // tileId -> { tilesetId, atlasX(col), atlasY(row), imageBacked, walkable, tags, opacity }
    const tileIndex = new Map<string, {
        tilesetId: string; atlasX: number; atlasY: number; imageBacked: boolean;
        walkable: boolean; tags: string[]; opacity: number;
    }>();
    for (const ts of tilesets) {
        const imageBacked = !!ts.imagePath;
        for (const t of ts.tiles) {
            tileIndex.set(t.id, {
                tilesetId: ts.id,
                atlasX: t.col,
                atlasY: t.row,
                imageBacked,
                walkable: t.walkable,
                tags: Array.isArray(t.tags) ? t.tags : [],
                opacity: Number.isFinite(t.opacity) ? t.opacity : 1,
            });
        }
    }
    const tilesetById = new Map(tilesets.map((ts) => [ts.id, ts]));

    const tileLayers: GodotTileLayer[] = [];

    for (const layer of project.tileLayers ?? []) {
        // Assign a stable atlas source index per image-backed tileset used here.
        const sourceIndexByTileset = new Map<string, number>();
        const atlasSources: GodotTileAtlasSource[] = [];
        const cells: GodotTileCell[] = [];
        const solidCells: Array<{ gridX: number; gridY: number }> = [];
        let tileCount = 0;
        const droppedTileIds: string[] = [];

        for (const placement of layer.tiles) {
            const def = tileIndex.get(placement.tileId);
            if (!def) {
                droppedTileIds.push(`tileId "${placement.tileId}"`);
                continue;
            }
            tileCount++;
            // Solidity is independent of art — a non-walkable tile blocks movement
            // whether it renders as an image or a colored placeholder.
            if (!def.walkable) solidCells.push({ gridX: placement.gridX, gridY: placement.gridY });

            if (!def.imageBacked) {
                // Color-only: keep the editor/renderer-2d pixels on the pack
                // cell so the scene can paint ColorRects and a loader can
                // reconstruct the grid. Do not invent atlas coords.
                cells.push({
                    gridX: placement.gridX,
                    gridY: placement.gridY,
                    sourceId: 0,
                    atlasX: 0,
                    atlasY: 0,
                    color: fallbackTileColor(def.tags),
                    opacity: def.opacity,
                });
                continue;
            }

            const ts = tilesetById.get(def.tilesetId);
            if (!ts) continue;

            let sourceId = sourceIndexByTileset.get(def.tilesetId);
            if (sourceId === undefined) {
                sourceId = atlasSources.length;
                sourceIndexByTileset.set(def.tilesetId, sourceId);
                atlasSources.push({
                    tilesetId: def.tilesetId,
                    texturePath: texturePathFor(def.tilesetId, ts.imagePath ?? ''),
                    tileWidth: ts.tileWidth,
                    tileHeight: ts.tileHeight,
                    sourceId,
                    atlasCoords: [],
                });

                // Honesty check (first time this layer references this tileset):
                // scene-builder.ts's collectTileResources emits the TileSet's grid
                // pitch (`tile_size`) from THIS layer's project-global tileSize, but
                // this atlas source's own slice size (`texture_region_size`) from the
                // tileset's own authored tileWidth/tileHeight — two independent,
                // unreconciled fields. The scene still loads when they disagree, but
                // the TileMapLayer's rendered art will not align to the grid it is
                // placed on. Nothing upstream cross-checks the two, so say so here.
                if (ts.tileWidth !== tileSize || ts.tileHeight !== tileSize) {
                    fidelity.push({
                        level: 'approximated',
                        domain: 'tiles',
                        severity: 'warning',
                        entityId: layer.id,
                        fieldPath: `tileLayers.${layer.id}.tileSize`,
                        message: `Layer "${layer.id}" uses tileset "${def.tilesetId}" (${ts.tileWidth}x${ts.tileHeight}px tiles), which does not match the project's grid tile size (${tileSize}px) — the emitted TileSet's tile_size and this atlas source's texture_region_size will disagree, and the rendered art will not align to the grid it is placed on.`,
                        reason: 'TileSet.tile_size is sourced from the project-global map.tileSize while each TileSetAtlasSource.texture_region_size is sourced from the tileset\'s own tileWidth/tileHeight; nothing reconciles the two.',
                    });
                }
            }
            const source = atlasSources[sourceId];
            if (!source.atlasCoords.some((c) => c.atlasX === def.atlasX && c.atlasY === def.atlasY)) {
                source.atlasCoords.push({ atlasX: def.atlasX, atlasY: def.atlasY });
            }
            cells.push({ gridX: placement.gridX, gridY: placement.gridY, sourceId, atlasX: def.atlasX, atlasY: def.atlasY });
        }

        const imageBacked = atlasSources.length > 0;
        tileLayers.push({
            nodeName: sanitizeNodeName(layer.name || layer.id),
            id: layer.id,
            name: layer.name,
            zIndex: layer.zIndex,
            tileSize,
            atlasSources,
            cells,
            solidCells,
            tileCount,
            imageBacked,
        });

        if (droppedTileIds.length > 0) {
            fidelity.push({
                level: 'dropped',
                domain: 'tiles',
                severity: 'warning',
                entityId: layer.id,
                fieldPath: `tileLayers.${layer.id}.tiles`,
                message: `${droppedTileIds.length} tile placement(s) in layer "${layer.id}" reference tile ids not found in any tileset — dropped: ${formatDroppedIdentities(droppedTileIds)}.`,
                reason: 'A placement\'s tileId did not resolve to a TileDefinition; the cell cannot be exported.',
            });
        }

        if (tileCount > 0 && imageBacked) {
            fidelity.push({
                level: 'lossless',
                domain: 'tiles',
                severity: 'info',
                entityId: layer.id,
                fieldPath: `tileLayers.${layer.id}`,
                message: `Layer "${layer.id}" exported ${cells.length} cell(s) into a TileMapLayer with ${atlasSources.length} atlas source(s).`,
                reason: 'Image-backed tilesets bake to TileSetAtlasSource cells in tile_map_data.',
            });
        } else if (tileCount > 0) {
            fidelity.push({
                level: 'approximated',
                domain: 'tiles',
                severity: 'info',
                entityId: layer.id,
                fieldPath: `tileLayers.${layer.id}`,
                message: `Layer "${layer.id}" (${tileCount} tile(s)) exported as a TileMapLayer with ${cells.length} ColorRect fallback cell(s); tileset(s) have no texture so an atlas is not baked.`,
                reason: 'A Godot TileSetAtlasSource requires a texture; color-only tilesets paint via ColorRect children using the editor/renderer-2d tag→color table, and the same cells land on the JSON pack.',
            });
        }
    }

    return { tileLayers, fidelity };
}

/**
 * Encode tile cells into the Godot 4 TileMapLayer `tile_map_data` byte layout:
 * a uint16 format header (TileMapLayer accepts a single format, id 0) followed
 * by 12 bytes per cell — x, y, source_id, atlas_x, atlas_y, alternative — each a
 * little-endian uint16 (negative grid coords wrap as int16 two's complement).
 * Returns a flat array of byte values (0-255) for PackedByteArray(...).
 *
 * The header value (0) and 12-byte cell stride are verified empirically against
 * Godot 4.7 (a header of 2 is rejected with "Unsupported tile map data format").
 */
export function encodeTileMapData(cells: GodotTileCell[]): number[] {
    const bytes: number[] = [];
    const u16 = (v: number) => { const x = v & 0xffff; bytes.push(x & 0xff, (x >> 8) & 0xff); };
    u16(0); // TileMapLayer tile_map_data format id
    for (const c of cells) {
        u16(c.gridX);
        u16(c.gridY);
        u16(c.sourceId);
        u16(c.atlasX);
        u16(c.atlasY);
        u16(0); // alternative tile
    }
    return bytes;
}
