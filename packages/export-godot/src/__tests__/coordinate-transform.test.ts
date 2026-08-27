/**
 * coordinate-transform.test.ts — grid (tile units) → Godot pixels.
 */

import { describe, it, expect } from 'vitest';
import { gridToGodot2D, gridToGodot3D, extentToGodot2D, DEFAULT_TILE_SIZE_PX } from '../coordinate-transform.js';

describe('gridToGodot2D', () => {
    it('scales grid coordinates by tileSize with no axis flip', () => {
        expect(gridToGodot2D(2, 3, 32)).toEqual({ x: 64, y: 96 });
        expect(gridToGodot2D(1, 1, 64)).toEqual({ x: 64, y: 64 });
    });

    it('defaults tileSize to DEFAULT_TILE_SIZE_PX', () => {
        expect(gridToGodot2D(1, 0)).toEqual({ x: DEFAULT_TILE_SIZE_PX, y: 0 });
    });

    it('throws when tileSize is not positive', () => {
        expect(() => gridToGodot2D(0, 0, 0)).toThrow(RangeError);
        expect(() => gridToGodot2D(0, 0, -16)).toThrow(RangeError);
    });
});

describe('gridToGodot3D', () => {
    it('maps elevation to Y and gridY to Z', () => {
        expect(gridToGodot3D(2, 3, 32, 5)).toEqual({ x: 64, y: 5, z: 96 });
    });
});

describe('extentToGodot2D', () => {
    it('scales a tile extent to pixels', () => {
        expect(extentToGodot2D(10, 5, 32)).toEqual({ x: 320, y: 160 });
    });
});
