/**
 * migrations.test.ts — Godot pack formatVersion chain (F-effa616a).
 */

import { describe, it, expect } from 'vitest';
import { GODOT_PACK_FORMAT_VERSION, type GodotContentPack } from '../export.js';
import { migrateGodotPack, parseSemVer, compareSemVer, isMigrationError } from '../migrations.js';

function stubPack(formatVersion: string): GodotContentPack {
    return {
        meta: {
            id: 'p-godot',
            name: 'P',
            version: '1',
            formatVersion,
            sourceProjectId: 'p',
            tileSize: 32,
            gridWidth: 10,
            gridHeight: 10,
        },
        zones: [],
        districts: [],
        entities: { byZone: {}, all: [], dropped: [], incomplete: false },
        items: [],
        navigationLinks: [],
        dialogues: [],
        assets: [],
        lootTables: [],
        spawnMarkers: [],
        transitions: [],
        tileLayers: [],
        props: [],
        markets: [],
        craftingStations: [],
        buildings: [],
        hubs: [],
        strongholds: [],
        strata: [],
        stratumLinks: [],
        hazards: [],
        zoneGates: [],
        files: {},
        worldSceneTscn: '',
    };
}

describe('parseSemVer / compareSemVer', () => {
    it('parses N.N.N and rejects malformed', () => {
        expect(parseSemVer('1.1.0')).toEqual({ major: 1, minor: 1, patch: 0 });
        expect(parseSemVer('1.0')).toBeUndefined();
        expect(parseSemVer('nope')).toBeUndefined();
    });

    it('compares major/minor/patch', () => {
        expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 1, patch: 0 }).cmp).toBeLessThan(0);
        expect(compareSemVer({ major: 1, minor: 1, patch: 0 }, { major: 1, minor: 1, patch: 0 }).cmp).toBe(0);
        expect(compareSemVer({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 1, patch: 0 }).sameMajor).toBe(false);
    });
});

describe('migrateGodotPack', () => {
    it('is a no-op at the current format version', () => {
        const pack = stubPack(GODOT_PACK_FORMAT_VERSION);
        const result = migrateGodotPack(pack);
        expect(isMigrationError(result)).toBe(false);
        if (isMigrationError(result)) return;
        expect(result.appliedSteps).toEqual([]);
        expect(result.pack.meta.formatVersion).toBe(GODOT_PACK_FORMAT_VERSION);
    });

    it('walks 1.0.0 → 1.1.0, defaulting files and zoneGates', () => {
        const pack = stubPack('1.0.0');
        delete (pack as { files?: unknown }).files;
        delete (pack as { zoneGates?: unknown }).zoneGates;
        const result = migrateGodotPack(pack, '1.1.0');
        expect(isMigrationError(result)).toBe(false);
        if (isMigrationError(result)) return;
        expect(result.appliedSteps).toEqual([{ from: '1.0.0', to: '1.1.0' }]);
        expect(result.pack.meta.formatVersion).toBe('1.1.0');
        expect(result.pack.files).toEqual({});
        expect(result.pack.zoneGates).toEqual([]);
    });

    it('refuses a different major', () => {
        const result = migrateGodotPack(stubPack('2.0.0'), '1.1.0');
        expect(isMigrationError(result)).toBe(true);
        if (!isMigrationError(result)) return;
        expect(result.code).toBe('UNKNOWN_MAJOR');
    });

    it('rejects a malformed formatVersion', () => {
        const result = migrateGodotPack(stubPack('not-a-version'));
        expect(isMigrationError(result)).toBe(true);
        if (!isMigrationError(result)) return;
        expect(result.code).toBe('MALFORMED_VERSION');
    });
});
