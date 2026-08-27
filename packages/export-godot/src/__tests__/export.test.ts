/**
 * export.test.ts — exportToGodot pack/scene contract.
 *
 * Covers F-12eeba99 (.tres files), F-14eadaad / F-3018c158 (dropped-field
 * fidelity), F-4d1e1c1e (scene refusal → GodotExportError), F-a5afd9fd (uid),
 * F-e0504b7a (zoneGates on pack), F-cb8a70e5 (tileSize on TransitionShape),
 * F-2d6bede0 (escaped spawn_condition), F-d1f450d0.
 */

import { describe, it, expect } from 'vitest';
import { exportToGodot, GODOT_PACK_FORMAT_VERSION } from '../export.js';
import { COVERED_FIELDS, KNOWN_DROPPED, ALL_WORLD_PROJECT_FIELDS } from '../field-coverage.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';

describe('FIELD_COVERAGE completeness', () => {
    it('classifies every WorldProject key as covered or dropped', () => {
        for (const field of ALL_WORLD_PROJECT_FIELDS) {
            const classified = COVERED_FIELDS.has(field) || KNOWN_DROPPED[field] !== undefined;
            expect(classified).toBe(true);
        }
        expect(COVERED_FIELDS.size + Object.keys(KNOWN_DROPPED).length).toBe(ALL_WORLD_PROJECT_FIELDS.length);
    });
});

describe('exportToGodot', () => {
    it('returns success for a minimal valid project', () => {
        const result = exportToGodot(minimalProject);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.contentPack.meta.formatVersion).toBe(GODOT_PACK_FORMAT_VERSION);
        expect(result.contentPack.zones.length).toBe(minimalProject.zones.length);
        expect(result.contentPack.worldSceneTscn).toContain('[gd_scene');
        expect(result.contentPack.worldSceneTscn).toContain('[node name="Player" type="CharacterBody2D" parent="."]');
        expect(result.contentPack.worldSceneTscn).toContain('[node name="Camera2D" type="Camera2D" parent="Player"]');
        expect(result.contentPack.worldSceneTscn).toContain('[ext_resource type="Resource" path="res://world_data/items/item-torch.tres"');
        expect(result.contentPack.worldSceneTscn).toContain('metadata/player_name = "Traveler"');
        expect(result.contentPack.files['res://scripts/player.gd']).toContain('extends CharacterBody2D');
        expect(result.assetCopies).toEqual([]);
    });

    it('attaches a .tres body for every stamped resourcePath (F-12eeba99)', () => {
        const result = exportToGodot(minimalProject);
        expect(result.success).toBe(true);
        if (!result.success) return;
        const { contentPack } = result;
        const paths = [
            ...contentPack.zones.map((z) => z.resourcePath),
            ...contentPack.districts.map((d) => d.resourcePath),
            ...contentPack.dialogues.map((d) => d.resourcePath),
            ...contentPack.items.map((i) => i.resourcePath),
            ...contentPack.lootTables.map((t) => t.resourcePath),
        ];
        expect(paths.length).toBeGreaterThan(0);
        for (const path of paths) {
            expect(path).toMatch(/^res:\/\/world_data\//);
            expect(contentPack.files[path]).toBeDefined();
            expect(contentPack.files[path]).toContain('[gd_resource type="Resource"');
            expect(contentPack.files[path]).toContain('[resource]');
        }
        expect(contentPack.files[contentPack.zones[0].resourcePath]).toContain('id = "zone-entrance"');
    });

    it('puts zone entry gates on the JSON pack, not only in the .tscn (F-e0504b7a)', () => {
        const project: WorldProject = {
            ...minimalProject,
            zones: minimalProject.zones.map((z, i) => i === 0
                ? { ...z, entryGate: { conditions: ['item:iron-key'], mode: 'hard', reason: 'Locked.' } }
                : z),
        };
        const result = exportToGodot(project);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.contentPack.zoneGates).toEqual([
            { zoneId: 'zone-entrance', conditions: ['item:iron-key'], mode: 'hard', reason: 'Locked.' },
        ]);
        expect(result.contentPack.worldSceneTscn).toContain('metadata/entry_gate = "item:iron-key"');
    });

    it('reports dropped fidelity (and incomplete) for authored landmarks (F-14eadaad)', () => {
        const result = exportToGodot(minimalProject);
        expect(result.success).toBe(true);
        if (!result.success) return;
        const droppedFields = result.fidelity.entries
            .filter((e) => e.level === 'dropped' && e.domain === 'world')
            .map((e) => e.fieldPath);
        expect(droppedFields).toEqual(expect.arrayContaining([
            'landmarks', 'encounterAnchors', 'factionPresences', 'pressureHotspots',
        ]));
        expect(droppedFields).not.toContain('playerTemplate');
        expect(result.fidelity.summary.incomplete).toBe(true);
        expect(result.fidelity.summary.dropped).toBeGreaterThan(0);
        expect(result.fidelity.summary.losslessPercent).toBeLessThan(100);
    });

    it('derives a per-project scene uid so two worlds do not collide (F-a5afd9fd)', () => {
        const a = exportToGodot({ ...minimalProject, id: 'world-alpha' });
        const b = exportToGodot({ ...minimalProject, id: 'world-beta' });
        expect(a.success && b.success).toBe(true);
        if (!a.success || !b.success) return;
        const uidA = a.contentPack.worldSceneTscn.match(/uid="([^"]+)"/)?.[1];
        const uidB = b.contentPack.worldSceneTscn.match(/uid="([^"]+)"/)?.[1];
        expect(uidA).toBe('uid://wf_world_alpha');
        expect(uidB).toBe('uid://wf_world_beta');
        expect(uidA).not.toBe(uidB);
    });

    it('returns GodotExportError (not a thrown exception) when assertParseable refuses (F-4d1e1c1e)', () => {
        const project = structuredClone(minimalProject);
        delete (project.itemPlacements[0] as { hidden?: boolean }).hidden;
        let thrown: unknown = null;
        let result: ReturnType<typeof exportToGodot> | undefined;
        try {
            result = exportToGodot(project);
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeNull();
        expect(result).toBeDefined();
        expect(result!.success).toBe(false);
        if (result!.success) return;
        expect(result!.errors[0].path).toBe('scene');
        expect(result!.errors[0].message).toMatch(/refusing to emit an unparseable scene/);
        expect(result!.errors[0].message).toContain('metadata/hidden = undefined');
    });

    it('escapes spawnCondition item:the "seal" in the .tscn (F-2d6bede0)', () => {
        const project: WorldProject = {
            ...minimalProject,
            entityPlacements: [
                { ...minimalProject.entityPlacements[0], spawnCondition: 'item:the "seal"' },
            ],
        };
        const result = exportToGodot(project);
        expect(result.success).toBe(true);
        if (!result.success) return;
        const line = result.contentPack.worldSceneTscn.split('\n').find((l) => l.startsWith('metadata/spawn_condition'));
        expect(line).toBeDefined();
        expect(line).toMatch(/^metadata\/spawn_condition = "(?:[^"\\]|\\.)*"$/);
        expect(line).toContain('\\"seal\\"');
    });

    it('sizes TransitionShape from project.map.tileSize (F-cb8a70e5)', () => {
        const project: WorldProject = {
            ...minimalProject,
            map: { ...minimalProject.map, tileSize: 64 },
            transitions: [{
                id: 'stair-1',
                zoneId: 'zone-entrance',
                targetZoneId: 'zone-cellar',
                type: 'stairwell',
                gridX: 1,
                gridY: 1,
            }],
        };
        const result = exportToGodot(project);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.contentPack.worldSceneTscn).toMatch(
            /\[sub_resource type="RectangleShape2D" id="TransitionShape"\]\nsize = Vector2\(64, 64\)/,
        );
    });

    it('omits the .tscn when includeWorldTscn is false', () => {
        const result = exportToGodot(minimalProject, { includeWorldTscn: false });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.contentPack.worldSceneTscn).toBe('');
        expect(Object.keys(result.contentPack.files).length).toBeGreaterThan(0);
    });

    it('promotes dropped fidelity onto warnings[] (item loss + authored landmarks) (F-344ebd6f)', () => {
        // Schema validation rejects missing-zone item placements, so the
        // convertItems orphan-drop cannot reach exportToGodot. item-torch in
        // minimalProject has no gridX/gridY → approximated/warning, which is
        // the item-loss channel that still returns success:true. Landmarks
        // are KNOWN_DROPPED. A warnings-only consumer must see both.
        const result = exportToGodot(minimalProject);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.warnings.some((w) => w.includes('WorldProject.landmarks is authored but not carried'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('item-torch'))).toBe(true);
        for (const e of result.fidelity.entries.filter((e) => e.level === 'dropped')) {
            expect(result.warnings).toContain(e.message);
        }
        expect(result.warnings.some((w) => w.includes(`${result.fidelity.summary.dropped}`))).toBe(true);
    });
});
