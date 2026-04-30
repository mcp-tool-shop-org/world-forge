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

function assert(condition: boolean, label: string, detail?: string): void {
    if (condition) {
        passed++;
        results.push({ ok: true, label });
        console.log(`    ✓ ${label}`);
    } else {
        failed++;
        results.push({ ok: false, label, detail });
        console.log(`    ✗ ${label}${detail ? ': ' + detail : ''}`);
    }
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

// Step 1: Export
console.log('── 1. Export proof world ──');
const result = exportToUnreal(proofProject);
assert(result.success === true, 'export_succeeds');
if (!result.success) {
    console.log('  FATAL: export failed', result.errors);
    process.exit(1);
}
const pack: UnrealContentPack = result.contentPack;
console.log(`    Zones: ${pack.Zones.length}`);
console.log(`    Actors: ${pack.Actors.All.length}`);
console.log(`    Connections: ${pack.Connections.length}`);
console.log(`    Transitions: ${pack.Transitions.length}`);

// Step 2: Pack structure
console.log('\n── 2. Pack structure ──');
const expectedKeys = ['Meta', 'Zones', 'Districts', 'Actors', 'Connections', 'WorldPartition', 'Parallax', 'Transitions'];
const packKeys = Object.keys(pack);
assert(
    expectedKeys.every((k) => packKeys.includes(k)),
    'all_top_level_keys_present',
    `missing: ${expectedKeys.filter((k) => !packKeys.includes(k)).join(', ') || 'none'}`,
);

// Step 3: Meta integrity
console.log('\n── 3. Meta integrity ──');
assert(pack.Meta.FormatVersion === UNREAL_PACK_FORMAT_VERSION, 'format_version_matches',
    `${pack.Meta.FormatVersion} vs ${UNREAL_PACK_FORMAT_VERSION}`);
assert(pack.Meta.TileSizeCm === TILE_SIZE_CM, 'tile_size_cm_correct',
    `got ${pack.Meta.TileSizeCm}`);
assert(pack.Meta.SourceTileSizePx === TILE_SIZE_PX, 'source_tile_size_px_preserved',
    `got ${pack.Meta.SourceTileSizePx}`);
assert(pack.Meta.SourceProjectId === proofProject.id, 'source_project_id_matches');
assert(pack.Meta.Id === proofProject.id, 'meta_id_matches_project');
assert(pack.Meta.Name === proofProject.name, 'meta_name_matches_project');

// Step 4: Coordinate transforms — Y-axis negation + elevation
console.log('\n── 4. Coordinate transforms ──');

// zone-cellar: gridX=0, gridY=4, elevation=-3
// Expected Unreal: X = 0*100 = 0, Y = -(4*100) = -400, Z = -3*100 = -300
const cellar = pack.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-cellar')!;
assert(cellar != null, 'cellar_zone_found');
assert(approxEq(cellar.OriginCm.X, 0), 'cellar_X_correct', `expected 0, got ${cellar.OriginCm.X}`);
assert(approxEq(cellar.OriginCm.Y, -400), 'cellar_Y_negated', `expected -400, got ${cellar.OriginCm.Y}`);
assert(approxEq(cellar.ElevationCm, -300), 'cellar_Z_from_elevation', `expected -300, got ${cellar.ElevationCm}`);

// zone-market: gridX=5, gridY=0, no elevation
// Expected: X=500, Y=0, Z=0
const market = pack.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-market')!;
assert(approxEq(market.OriginCm.X, 500), 'market_X_correct', `expected 500, got ${market.OriginCm.X}`);
assert(approxEq(market.OriginCm.Y, 0), 'market_Y_zero', `expected 0, got ${market.OriginCm.Y}`);
assert(approxEq(market.ElevationCm, 0), 'market_Z_zero', `expected 0, got ${market.ElevationCm}`);

// zone-alley: gridX=11, gridY=2
// Expected: X=1100, Y=-200, Z=0
const alley = pack.Zones.find((z: UnrealZoneDataAsset) => z.Id === 'zone-alley')!;
assert(approxEq(alley.OriginCm.X, 1100), 'alley_X_correct', `expected 1100, got ${alley.OriginCm.X}`);
assert(approxEq(alley.OriginCm.Y, -200), 'alley_Y_negated', `expected -200, got ${alley.OriginCm.Y}`);

// Elevation range: cellar floor=-5→-500cm, ceiling=-1→-100cm
assert(cellar.ElevationRangeCm != null, 'cellar_elevation_range_present');
assert(approxEq(cellar.ElevationRangeCm!.FloorCm, -500), 'cellar_floor_cm',
    `expected -500, got ${cellar.ElevationRangeCm!.FloorCm}`);
assert(approxEq(cellar.ElevationRangeCm!.CeilingCm, -100), 'cellar_ceiling_cm',
    `expected -100, got ${cellar.ElevationRangeCm!.CeilingCm}`);

// Step 5: ID/reference preservation
console.log('\n── 5. ID/reference preservation ──');
const zoneIds = new Set(pack.Zones.map((z: UnrealZoneDataAsset) => z.Id));
const sourceZoneIds = new Set(proofProject.zones.map((z) => z.id));

// All source zone IDs appear in pack
assert(
    [...sourceZoneIds].every((id) => zoneIds.has(id)),
    'all_zone_ids_preserved',
);

// Connections reference valid zone IDs
const connectionZoneRefs = pack.Connections.flatMap((c) => [c.FromZoneId, c.ToZoneId]);
assert(
    connectionZoneRefs.every((id) => zoneIds.has(id)),
    'connection_zone_refs_valid',
    `orphans: ${connectionZoneRefs.filter((id) => !zoneIds.has(id)).join(', ') || 'none'}`,
);

// Actor zone placements reference valid zone IDs
const actorZoneRefs = pack.Actors.All.map((a: UnrealActorSpawnEntry) => a.ZoneId);
assert(
    actorZoneRefs.every((id) => zoneIds.has(id)),
    'actor_zone_refs_valid',
    `orphans: ${actorZoneRefs.filter((id) => !zoneIds.has(id)).join(', ') || 'none'}`,
);

// Transition zone refs valid
if (pack.Transitions.length > 0) {
    const transZoneRefs = pack.Transitions.flatMap((t) => [t.ZoneId, t.TargetZoneId]);
    assert(
        transZoneRefs.every((id) => zoneIds.has(id)),
        'transition_zone_refs_valid',
    );
} else {
    assert(true, 'transition_zone_refs_valid'); // vacuously true
}

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
for (const a of pack.Actors.All) {
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
const merchantActor = pack.Actors.All.find((a: UnrealActorSpawnEntry) => a.Role === 'merchant');
assert(merchantActor != null, 'merchant_actor_present');
assert(merchantActor!.BlueprintTag === 'BP_Merchant', 'merchant_bp_tag_correct');

// Step 7: Actor manifest completeness
console.log('\n── 7. Actor manifest completeness ──');
assert(pack.Actors.Dropped.length === 0, 'no_dropped_entities',
    `dropped: ${pack.Actors.Dropped.length}`);
assert(pack.Actors.Incomplete === false, 'manifest_not_incomplete');
// ByZone should cover all actors
const byZoneCount = Object.values(pack.Actors.ByZone).reduce((sum, arr) => sum + arr.length, 0);
assert(byZoneCount === pack.Actors.All.length, 'by_zone_covers_all_actors',
    `ByZone=${byZoneCount}, All=${pack.Actors.All.length}`);

// Step 8: Connection streaming hints
console.log('\n── 8. Connection streaming hints ──');
// tavern→market is 'door' → StreamMode 'load'
const doorConn = pack.Connections.find((c) => c.Kind === 'door');
assert(doorConn != null, 'door_connection_found');
assert(doorConn!.StreamMode === 'load', 'door_stream_mode_is_load',
    `got ${doorConn!.StreamMode}`);
// tavern→cellar is 'stairs' → StreamMode 'load'
const stairsConn = pack.Connections.find((c) => c.Kind === 'stairs');
assert(stairsConn != null, 'stairs_connection_found');
assert(stairsConn!.StreamMode === 'load', 'stairs_stream_mode_is_load',
    `got ${stairsConn!.StreamMode}`);

// ── Verdict ──────────────────────────────────────────────────
console.log(`\n═══ VERDICT: ${failed === 0 ? 'PASS' : 'FAIL'} ═══`);
console.log(`  Assertions: ${passed}/${passed + failed} passed`);

writeReceipt();
process.exit(failed === 0 ? 0 : 1);

// ── Receipt ──────────────────────────────────────────────────
function writeReceipt(): void {
    mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString();
    const verdict = failed === 0 ? 'PASS' : 'FAIL';

    const receipt = `# Unreal Engine 5 Importer Smoke — ${verdict}

**Date:** ${ts}
**Proof world:** Dustwalk — Multi-Target Proof (proof-dustwalk)
**Schema:** ${proofProject.version}
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
| Zones | ${pack.Zones.length} |
| Districts | ${pack.Districts.length} |
| Actors | ${pack.Actors.All.length} |
| Connections | ${pack.Connections.length} |
| Transitions | ${pack.Transitions.length} |

## Coordinate Spot-Checks

| Zone | gridX,gridY | elevation | → X cm | → Y cm | → Z cm |
|------|-------------|-----------|--------|--------|--------|
| cellar | 0,4 | -3m | 0 | -400 | -300 |
| market | 5,0 | 0m | 500 | 0 | 0 |
| alley | 11,2 | 0m | 1100 | -200 | 0 |

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
