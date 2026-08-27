/**
 * copy-assets.test.ts — authored image file channel (F-fd38903f).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isRemoteAssetUri, planAuthoredAssetCopies, resourcePathToRel } from '../copy-assets.js';

describe('isRemoteAssetUri', () => {
    it('treats http(s)/data/file URIs as remote', () => {
        expect(isRemoteAssetUri('https://example.com/a.png')).toBe(true);
        expect(isRemoteAssetUri('http://example.com/a.png')).toBe(true);
        expect(isRemoteAssetUri('data:image/png;base64,xxx')).toBe(true);
        expect(isRemoteAssetUri('file:///C:/art/a.png')).toBe(true);
    });

    it('treats Windows drive paths and relative files as local', () => {
        expect(isRemoteAssetUri('C:\\art\\a.png')).toBe(false);
        expect(isRemoteAssetUri('art/a.png')).toBe(false);
        expect(isRemoteAssetUri('/abs/a.png')).toBe(false);
    });
});

describe('resourcePathToRel', () => {
    it('strips res:// and rejects .. segments', () => {
        expect(resourcePathToRel('res://world_data/zones/z.tres')).toBe('world_data/zones/z.tres');
        expect(resourcePathToRel('res://../secret')).toBe('secret');
    });
});

describe('planAuthoredAssetCopies', () => {
    let dir: string;

    beforeAll(async () => {
        dir = join(tmpdir(), `wf-godot-copy-${Date.now()}`);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'town.png'), Buffer.from('png'));
    });

    afterAll(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('copies a readable tileset imagePath and skips color-only tilesets', () => {
        const { copies, fidelity } = planAuthoredAssetCopies({
            assets: [],
            tilesets: [
                {
                    id: 'town', name: 'Town', tileWidth: 32, tileHeight: 32,
                    imagePath: 'town.png', tiles: [],
                },
                {
                    id: 'color', name: 'Color', tileWidth: 32, tileHeight: 32, tiles: [],
                },
            ],
            props: [],
            baseDir: dir,
        });
        expect(copies).toEqual([
            expect.objectContaining({
                destRel: 'assets/tilesets/town.png',
                godotPath: 'res://assets/tilesets/town.png',
            }),
        ]);
        expect(fidelity).toHaveLength(0);
    });

    it('warns for a URI asset and a missing local file', () => {
        const { copies, fidelity } = planAuthoredAssetCopies({
            assets: [
                {
                    id: 'remote', kind: 'sprite', label: 'R', sourcePath: 'https://example.com/x.png',
                    godotPath: 'res://assets/sprites/x.png', tags: [],
                },
                {
                    id: 'gone', kind: 'sprite', label: 'G', sourcePath: 'missing.png',
                    godotPath: 'res://assets/sprites/missing.png', tags: [],
                },
            ],
            tilesets: [],
            props: [],
            baseDir: dir,
        });
        expect(copies).toHaveLength(0);
        expect(fidelity.some((e) => e.entityId === 'remote' && e.message.includes('URI'))).toBe(true);
        expect(fidelity.some((e) => e.entityId === 'gone' && e.message.includes('missing'))).toBe(true);
    });
});
