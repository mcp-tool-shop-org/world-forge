/**
 * convert-assets.test.ts — AssetEntry → Godot asset binding.
 *
 * F-6a7aa649: version/provenance were omitted while fidelity claimed lossless;
 * unknown kind produced `undefined/<filename>` and still claimed lossless.
 */

import { describe, it, expect } from 'vitest';
import { convertAssets, FALLBACK_ASSET_DIR } from '../convert-assets.js';
import type { WorldProject, AssetEntry, AssetKind } from '@world-forge/schema';

function proj(assets: AssetEntry[]): WorldProject {
    return { assets } as unknown as WorldProject;
}

describe('convertAssets', () => {
    it('copies provenance.license (and version) onto the binding instead of dropping them', () => {
        const { assets, fidelity } = convertAssets(proj([{
            id: 'seal-art',
            kind: 'sprite',
            label: 'Seal',
            path: 'art/seal.png',
            tags: ['item'],
            version: '2.1.0',
            provenance: { license: 'CC-BY-4.0', author: 'Ada', source: 'hand-drawn' },
        }]));
        expect(assets[0].godotPath).toBe('res://assets/sprites/seal.png');
        expect(assets[0].version).toBe('2.1.0');
        expect(assets[0].provenance).toEqual({ license: 'CC-BY-4.0', author: 'Ada', source: 'hand-drawn' });
        expect(fidelity[0].level).toBe('lossless');
    });

    it('uses basename of the source path, matching convert-tile-layers', () => {
        const { assets } = convertAssets(proj([{
            id: 'img',
            kind: 'tileset',
            label: 'Town',
            path: 'tiles/town.png',
            tags: [],
        }]));
        expect(assets[0].godotPath).toBe('res://assets/tilesets/town.png');
    });

    it('falls back to a misc directory and approximated fidelity for an unknown kind', () => {
        const { assets, fidelity } = convertAssets(proj([{
            id: 'whoosh',
            kind: 'sfx' as AssetKind,
            label: 'Whoosh',
            path: 'sfx/whoosh.wav',
            tags: [],
        }]));
        expect(assets[0].godotPath).toBe(`${FALLBACK_ASSET_DIR}/whoosh.wav`);
        expect(assets[0].godotPath).not.toContain('undefined/');
        const entry = fidelity.find((f) => f.entityId === 'whoosh');
        expect(entry?.level).toBe('approximated');
        expect(entry?.fieldPath).toBe('assets.whoosh.kind');
    });

    it('falls back to ${id}.png when the source path has no extension', () => {
        const { assets } = convertAssets(proj([{
            id: 'portrait-1',
            kind: 'portrait',
            label: 'Face',
            path: 'portraits/keeper',
            tags: [],
        }]));
        expect(assets[0].godotPath).toBe('res://assets/portraits/portrait-1.png');
    });
});
