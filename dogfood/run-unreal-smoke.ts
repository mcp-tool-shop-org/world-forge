/**
 * run-unreal-smoke.ts — Unreal Engine 5 importer consumer smoke.
 *
 * Proves the Unreal export from World Forge is structurally consumable by an
 * expected UE5 DataAsset importer. Validates:
 *
 *   1. Export succeeds with valid UnrealContentPack
 *   2. Pack structure — all expected top-level keys present
 *   3. Meta integrity — FormatVersion, TileSizeCm, SourceProjectId
 *   4. Coordinate transform — Y-axis negation, elevation→Z, scale correctness
 *   5. ID/reference preservation — zone IDs in Actors, Connections, Transitions
 *   6. Blueprint tag assignment — EntityRole → BlueprintTag mapping
 *   7. Actor manifest completeness — no dropped entities, ByZone coverage
 *   8. Connection streaming hints — kind→StreamMode mapping
 *
 * Does NOT launch Unreal Editor. This is a structural/parser-level proof that
 * the JSON pack has the shape and semantics a UE5 loader requires.
 *
 * Run: npx tsx dogfood/run-unreal-smoke.ts
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { proofProject } from './worlds/multi-target-proof.js';
import { SCHEMA_VERSION } from '../packages/schema/src/index.js';
import { exportToUnreal, UNREAL_PACK_FORMAT_VERSION } from '../packages/export-unreal/src/index.js';
import type { UnrealContentPack, UnrealZoneDataAsset, UnrealActorSpawnEntry } from '../packages/export-unreal/src/index.js';

const __dirname = typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'output', 'unreal-smoke');

// ── Test harness ─────────────────────────────────────────────
type Result = { ok: boolean; label: string; detail?: string };
const results: Result[] = [];
let passed = 0;
let failed = 0;
let pack: UnrealContentPack | undefined;

function assert(condition: boolean, label: string, detail?: string): boolean {
    if (condition) {
        passed++;
        results.push({ ok: true, label });
        console.log(`    ✓ ${label}`);
        return true;
    }
    failed++;
    results.push({ ok: false, label, detail });
    console.log(`    ✗ ${label}${detail ? ': ' + detail : ''}`);
    return false;
}

class FixtureMissingError extends Error {
    constructor(label: string) {
        super(`required fixture missing: ${label}`);
        this.name = 'FixtureMissingError';
    }
}

function requireValue<T>(value: T | null | undefined, label: string): T {
    if (value == null) {
        assert(false, label, 'required fixture missing');
        throw new FixtureMissingError(label);
    }
    assert(true, label);
    return value;
}

// ── Constants ────────────────────────────────────────────────
const TILE_SIZE_PX = 32;       // proof world tileSize
const TILE_SIZE_CM = 100;      // default Unreal scale (1 tile = 1m = 100cm)
const EPSILON = 0.001;         // float comparison tolerance

function approxEq(a: number, b: number): boolean {
    return Math.abs(a - b) < EPSILON;
}

// ── Smoke ────────────────────────────────────────────────────
console.log('═══ UNREAL ENGINE 5 IMPORTER SMOKE ═══\n');

function run(): void {
    try {
        // Step 1: Export
        console.log('── 1. Export proof world ──');
        const result = exportToUnreal(proofProject);
        assert(result.success === true, 'export_succeeds');
        if (!result.success) {
            console.error('  FATAL: export failed');
            for (const e of result.errors) {
                console.error(`    ${e.path ?? '(root)'}: ${e.message}`);
            }
            return;
        }
        const exported = result.contentPack;
        pack = exported;
        console.log(`    Zones: ${exported.Zones.length}`);
        console.log(`    Actors: ${exported.Actors.All.length}`);
        console.log(`    Connections: ${exported.Connections.length}`);
        console.log(`    Transitions: ${exported.Transitions.length}`);

        // F-fb07f3a1: drop cellar so requireValue records a fail and still writes a receipt.
        if (process.env.WORLD_FORGE_FORCE_UNREAL_DROP_CELLAR === '1') {
            exported.Zones = exported.Zones.filter((z: UnrealZoneDataAsset) => z.Id !== 'zone-cellar');
        }

        // Step 2: Pack structure
        console.log('\n── 2. Pack structure ──');
        const expectedKeys = ['Meta', 'Zones', 'Districts', 'Actors', 'Connections', 'WorldPartition', 'Parallax', 'Transitions'];
        const packKeys = Object.keys(exported);
        assert(
            expectedKeys.every((k) => packKeys.includes(k)),
            'all_top_level_keys_present',
            `missing: ${expectedKeys.filter((k) => !packKeys.includes(k)).join(', ') || 'none'}`,
        );

        // Step 3: Meta integrity
        console.log('\n── 3. Meta integrity ──');
        assert(exported.Meta.FormatVersion === UNREAL_PACK_FORMAT_VERSION, 'format_version_matches',
            `${exported.Meta.FormatVersion} vs ${UNREAL_PACK_FORMAT_VERSION}`);
        assert(exported.Meta.TileSizeCm === TILE_SIZE_CM, 'tile_size_cm_correct',
            `got ${exported.Meta.TileSizeCm}`);
        assert(exported.Meta.SourceTileSizePx === TILE_SIZE_PX, 'source_tile_size_px_preserved',
            `got ${exported.Meta.SourceTileSizePx}`);
        assert(exported.Meta.SourceProjectId === proofProject.id, 'source_project_id_matches');
        assert(exported.Meta.Id === proofProject.id, 'meta_id_matches_project');
        assert(exported.Meta.Name === proofProject.name, 'meta_name_matches_project');

        // Step 4: Coordinate transforms — Y-axis negation + elevation
        console.log('\n── 4. Coordinate transforms ──');

        // zone-cellar: gridX=0, gridY=4, elevation=-3
        // Expected Unreal: X = 0*100 = 0, Y = -(4*100) = -400, Z = -3*100 = -300
        const cellar = requireValue(
            exported.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-cellar'),
            'cellar_zone_found',
        );
        assert(approxEq(cellar.OriginCm.X, 0), 'cellar_X_correct', `expected 0, got ${cellar.OriginCm.X}`);
        assert(approxEq(cellar.OriginCm.Y, -400), 'cellar_Y_negated', `expected -400, got ${cellar.OriginCm.Y}`);
        assert(approxEq(cellar.ElevationCm, -300), 'cellar_Z_from_elevation', `expected -300, got ${cellar.ElevationCm}`);

        // zone-market: gridX=5, gridY=0, no elevation
        // Expected: X=500, Y=0, Z=0
        const market = requireValue(
            exported.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-market'),
            'market_zone_found',
        );
        assert(approxEq(market.OriginCm.X, 500), 'market_X_correct', `expected 500, got ${market.OriginCm.X}`);
        assert(approxEq(market.OriginCm.Y, 0), 'market_Y_zero', `expected 0, got ${market.OriginCm.Y}`);
        assert(approxEq(market.ElevationCm, 0), 'market_Z_zero', `expected 0, got ${market.ElevationCm}`);

        // zone-alley: gridX=11, gridY=2
        // Expected: X=1100, Y=-200, Z=0
        const alley = requireValue(
            exported.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-alley'),
            'alley_zone_found',
        );
        assert(approxEq(alley.OriginCm.X, 1100), 'alley_X_correct', `expected 1100, got ${alley.OriginCm.X}`);
        assert(approxEq(alley.OriginCm.Y, -200), 'alley_Y_negated', `expected -200, got ${alley.OriginCm.Y}`);

        // Elevation range: cellar floor=-5→-500cm, ceiling=-1→-100cm
        const cellarRange = requireValue(cellar.ElevationRangeCm, 'cellar_elevation_range_present');
        assert(approxEq(cellarRange.FloorCm, -500), 'cellar_floor_cm',
            `expected -500, got ${cellarRange.FloorCm}`);
        assert(approxEq(cellarRange.CeilingCm, -100), 'cellar_ceiling_cm',
            `expected -100, got ${cellarRange.CeilingCm}`);

        // Step 5: ID/reference preservation
        console.log('\n── 5. ID/reference preservation ──');
        const zoneIds = new Set(exported.Zones.map((z: UnrealZoneDataAsset) => z.Id));
        const sourceZoneIds = new Set(proofProject.zones.map((z) => z.id));

        // All source zone IDs appear in pack
        assert(
            [...sourceZoneIds].every((id) => zoneIds.has(id)),
            'all_zone_ids_preserved',
        );

        // Connections reference valid zone IDs
        const connectionZoneRefs = exported.Connections.flatMap((c) => [c.FromZoneId, c.ToZoneId]);
        assert(
            connectionZoneRefs.every((id) => zoneIds.has(id)),
            'connection_zone_refs_valid',
            `orphans: ${connectionZoneRefs.filter((id) => !zoneIds.has(id)).join(', ') || 'none'}`,
        );

        // Actor zone placements reference valid zone IDs
        const actorZoneRefs = exported.Actors.All.map((a: UnrealActorSpawnEntry) => a.ZoneId);
        assert(
            actorZoneRefs.every((id) => zoneIds.has(id)),
            'actor_zone_refs_valid',
            `orphans: ${actorZoneRefs.filter((id) => !zoneIds.has(id)).join(', ') || 'none'}`,
        );

        // Transition zone refs valid
        //
        // F-933d65b9: the empty-array branch used to `assert(true, 'transition_zone_refs_valid')`,
        // so a convert-transitions regression that emitted [] still recorded a pass
        // for the step that claims to prove 'ID/reference preservation — zone IDs in
        // … Transitions'. Require the pack count to match the proof fixture (which
        // must itself be > 0), then validate refs — never a vacuous true.
        if (process.env.WORLD_FORGE_FORCE_UNREAL_EMPTY_TRANSITIONS === '1') {
            exported.Transitions.length = 0;
        }
        const expectedTransitionCount = (proofProject.transitions ?? []).length;
        assert(
            expectedTransitionCount > 0,
            'proof_fixture_has_transitions',
            'Dustwalk proof world must include at least one transition — an empty fixture would make the ref check vacuous',
        );
        assert(
            exported.Transitions.length === expectedTransitionCount,
            'transition_count_matches_source',
            `pack=${exported.Transitions.length}, source=${expectedTransitionCount}`,
        );
        const transZoneRefs = exported.Transitions.flatMap((t) => [t.ZoneId, t.TargetZoneId]);
        assert(
            exported.Transitions.length > 0 && transZoneRefs.every((id) => zoneIds.has(id)),
            'transition_zone_refs_valid',
            exported.Transitions.length === 0
                ? 'Transitions is empty — cannot validate refs'
                : `orphans: ${transZoneRefs.filter((id) => !zoneIds.has(id)).join(', ') || 'none'}`,
        );

        // Step 6: Blueprint tag assignment
        console.log('\n── 6. Blueprint tag assignment ──');
        const EXPECTED_TAGS: Record<string, string> = {
            merchant: 'BP_Merchant',
            enemy: 'BP_Enemy_Generic',
            npc: 'BP_NPC_Generic',
            boss: 'BP_Boss',
            companion: 'BP_Companion',
            'quest-giver': 'BP_QuestGiver',
        };
        const actorsByRole = new Map<string, UnrealActorSpawnEntry>();
        for (const a of exported.Actors.All) {
            if (!actorsByRole.has(a.Role)) actorsByRole.set(a.Role, a);
        }
        for (const [role, expectedTag] of Object.entries(EXPECTED_TAGS)) {
            const actor = actorsByRole.get(role);
            if (actor) {
                assert(actor.BlueprintTag === expectedTag, `bp_tag_${role}`,
                    `expected ${expectedTag}, got ${actor.BlueprintTag}`);
            }
        }
        // At minimum, merchant should be present in proof world
        const merchantActor = requireValue(
            exported.Actors.All.find((a: UnrealActorSpawnEntry) => a.Role === 'merchant'),
            'merchant_actor_present',
        );
        assert(merchantActor.BlueprintTag === 'BP_Merchant', 'merchant_bp_tag_correct');

        // Step 7: Actor manifest completeness
        console.log('\n── 7. Actor manifest completeness ──');
        assert(exported.Actors.Dropped.length === 0, 'no_dropped_entities',
            `dropped: ${exported.Actors.Dropped.length}`);
        assert(exported.Actors.Incomplete === false, 'manifest_not_incomplete');
        // ByZone should cover all actors
        const byZoneCount = Object.values(exported.Actors.ByZone).reduce((sum, arr) => sum + arr.length, 0);
        assert(byZoneCount === exported.Actors.All.length, 'by_zone_covers_all_actors',
            `ByZone=${byZoneCount}, All=${exported.Actors.All.length}`);

        // Step 8: Connection streaming hints
        console.log('\n── 8. Connection streaming hints ──');
        // tavern→market is 'door' → StreamMode 'load'
        const doorConn = requireValue(
            exported.Connections.find((c) => c.Kind === 'door'),
            'door_connection_found',
        );
        assert(doorConn.StreamMode === 'load', 'door_stream_mode_is_load',
            `got ${doorConn.StreamMode}`);
        // tavern→cellar is 'stairs' → StreamMode 'load'
        const stairsConn = requireValue(
            exported.Connections.find((c) => c.Kind === 'stairs'),
            'stairs_connection_found',
        );
        assert(stairsConn.StreamMode === 'load', 'stairs_stream_mode_is_load',
            `got ${stairsConn.StreamMode}`);
    } catch (err) {
        if (!(err instanceof FixtureMissingError)) {
            assert(false, 'runner_crash', String(err));
        }
    } finally {
        console.log(`\n═══ VERDICT: ${failed === 0 ? 'PASS' : 'FAIL'} ═══`);
        console.log(`  Assertions: ${passed}/${passed + failed} passed`);
        writeReceipt();
    }
}

// ── Receipt ──────────────────────────────────────────────────
// F-c621e532: rows come from pack.Zones[].OriginCm / ElevationCm (or n/a
// when the zone is missing). Hardcoded 0,-400,-300 painted a success-shaped
// table on FORCE_UNREAL_DROP_CELLAR even after cellar_zone_found failed.
const COORD_SPOT_CHECKS: Array<{ id: string; label: string }> = [
    { id: 'zone-cellar', label: 'cellar' },
    { id: 'zone-market', label: 'market' },
    { id: 'zone-alley', label: 'alley' },
];

function coordinateSpotCheckRows(): string {
    return COORD_SPOT_CHECKS.map(({ id, label }) => {
        const source = proofProject.zones.find((z) => z.id === id);
        const live = pack?.Zones.find((z: UnrealZoneDataAsset) => z.Id === id);
        const grid = source ? `${source.gridX},${source.gridY}` : 'n/a';
        const elev = source ? `${source.elevation ?? 0}m` : 'n/a';
        if (!live) {
            return `| ${label} | ${grid} | ${elev} | n/a | n/a | n/a |`;
        }
        return `| ${label} | ${grid} | ${elev} | ${live.OriginCm.X} | ${live.OriginCm.Y} | ${live.ElevationCm} |`;
    }).join('\n');
}

function writeReceipt(): void {
    mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString();
    const verdict = failed === 0 ? 'PASS' : 'FAIL';
    const zones = pack?.Zones.length ?? 'n/a';
    const districts = pack?.Districts.length ?? 'n/a';
    const actors = pack?.Actors.All.length ?? 'n/a';
    const connections = pack?.Connections.length ?? 'n/a';
    const transitions = pack?.Transitions.length ?? 'n/a';

    const receipt = `# Unreal Engine 5 Importer Smoke — ${verdict}

**Date:** ${ts}
**Proof world:** Dustwalk — Multi-Target Proof (proof-dustwalk)
**Schema:** ${SCHEMA_VERSION}
**Project version:** ${proofProject.version}
**Format version:** ${UNREAL_PACK_FORMAT_VERSION}
**Tile scale:** ${TILE_SIZE_PX}px → ${TILE_SIZE_CM}cm (1 tile = 1m)

## Pipeline

1. World Forge export → UnrealContentPack
2. Pack structure validation (8 top-level keys)
3. Meta integrity (FormatVersion, TileSizeCm, SourceProjectId)
4. Coordinate transform (Y-axis negation, elevation→Z, scale)
5. ID/reference preservation (zones, actors, connections, transitions)
6. Blueprint tag assignment (role → BP class tag)
7. Actor manifest completeness (no dropped, ByZone coverage)
8. Connection streaming hints (kind → StreamMode)

## Assertions (${passed} passed, ${failed} failed)

${results.map(r => `- ${r.ok ? '✓' : '✗'} ${r.label}${r.detail ? ': ' + r.detail : ''}`).join('\n')}

## Content Counts

| Metric | Value |
|--------|-------|
| Zones | ${zones} |
| Districts | ${districts} |
| Actors | ${actors} |
| Connections | ${connections} |
| Transitions | ${transitions} |

## Coordinate Spot-Checks

| Zone | gridX,gridY | elevation | → X cm | → Y cm | → Z cm |
|------|-------------|-----------|--------|--------|--------|
${coordinateSpotCheckRows()}

## Verdict

**${verdict}**

${verdict === 'PASS'
            ? 'Exported UnrealContentPack is structurally consumable by a UE5 DataAsset importer. Coordinate transforms respect Y-axis negation and elevation→Z scale. All IDs and cross-references preserved. Blueprint tags assigned correctly.'
            : 'UE5 importer would reject this pack. See failures above.'}
`;

    const receiptPath = resolve(outDir, `DOGFOOD_UNREAL_SMOKE_${ts.slice(0, 10)}.md`);
    writeFileSync(receiptPath, receipt, 'utf-8');
    console.log(`\nReceipt: ${receiptPath}`);
}

run();
process.exit(failed === 0 ? 0 : 1);
