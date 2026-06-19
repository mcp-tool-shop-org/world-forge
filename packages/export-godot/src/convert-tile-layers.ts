/**
 * convert-tile-layers.ts — WorldProject tile layers → Godot TileMapLayer entries.
 *
 * Each `TileLayer` becomes one `TileMapLayer` node backed by a `TileSet`:
 *  - Image-backed tilesets (with an imagePath) export a `TileSetAtlasSource`
 *    referencing the tileset texture, and the layer's placements are baked into
 *    `tile_map_data` cells (atlas coords from each tile's row/col).
 *  - Color-only tilesets (no image) can't form an atlas source, so the layer
 *    exports a TileSet scaffold (correct tile_size) + placement metadata; the
 *    cells load data-driven from the content pack. This mirrors the editor's
 *    image-vs-colored-fallback rendering.
 *
 * Unknown tile ids (not in any tileset) are dropped with a fidelity warning.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { DEFAULT_TILE_SIZE_PX } from './coordinate-transform.js';

/** A single baked tile cell — references an atlas source within the layer's TileSet. */
export interface GodotTileCell {
    gridX: number;
    gridY: number;
    /** Index of the atlas source within this layer's TileSet `sources/N`. */
    sourceId: number;
    /** Atlas coordinates (column, row) within the source texture. */
    atlasX: number;
    atlasY: number;
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
    /** Cells baked into tile_map_data (image-backed placements only). */
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

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

/** Godot import convention for a tileset texture (peer to convert-assets' `res://assets/tilesets`). */
function texturePathFor(tilesetId: string): string {
    return `res://assets/tilesets/${tilesetId}.png`;
}

export function convertTileLayers(project: WorldProject): ConvertTileLayersResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];

    const tilesets = project.tilesets ?? [];
    // tileId -> { tilesetId, atlasX(col), atlasY(row), imageBacked, walkable }
    const tileIndex = new Map<string, { tilesetId: string; atlasX: number; atlasY: number; imageBacked: boolean; walkable: boolean }>();
    for (const ts of tilesets) {
        const imageBacked = !!ts.imagePath;
        for (const t of ts.tiles) {
            tileIndex.set(t.id, { tilesetId: ts.id, atlasX: t.col, atlasY: t.row, imageBacked, walkable: t.walkable });
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
        let droppedCount = 0;

        for (const placement of layer.tiles) {
            const def = tileIndex.get(placement.tileId);
            if (!def) {
                droppedCount++;
                continue;
            }
            tileCount++;
            // Solidity is independent of art — a non-walkable tile blocks movement
            // whether it renders as an image or a colored placeholder.
            if (!def.walkable) solidCells.push({ gridX: placement.gridX, gridY: placement.gridY });

            if (!def.imageBacked) continue; // color-only: counted, no atlas cell

            const ts = tilesetById.get(def.tilesetId);
            if (!ts) continue;

            let sourceId = sourceIndexByTileset.get(def.tilesetId);
            if (sourceId === undefined) {
                sourceId = atlasSources.length;
                sourceIndexByTileset.set(def.tilesetId, sourceId);
                atlasSources.push({
                    tilesetId: def.tilesetId,
                    texturePath: texturePathFor(def.tilesetId),
                    tileWidth: ts.tileWidth,
                    tileHeight: ts.tileHeight,
                    sourceId,
                    atlasCoords: [],
                });
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

        if (droppedCount > 0) {
            fidelity.push({
                level: 'dropped',
                domain: 'tiles',
                severity: 'warning',
                entityId: layer.id,
                fieldPath: `tileLayers.${layer.id}.tiles`,
                message: `${droppedCount} tile placement(s) in layer "${layer.id}" reference tile ids not found in any tileset — dropped.`,
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
                message: `Layer "${layer.id}" (${tileCount} tile(s)) exported as a TileMapLayer scaffold + placement metadata; cells are not baked because its tileset(s) have no texture.`,
                reason: 'A Godot TileSetAtlasSource requires a texture; color-only tilesets load cells data-driven from the content pack.',
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
