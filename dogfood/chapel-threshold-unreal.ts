// dogfood/chapel-threshold-unreal.ts — export the chapel fixture with elevation to the UE5 lane
// Run: npx tsx dogfood/chapel-threshold-unreal.ts

import { chapelProject } from '../packages/schema/src/__tests__/fixtures/chapel-authored.js';
import { exportToUnreal } from '../packages/export-unreal/src/export.js';
import type { WorldProject } from '../packages/schema/src/index.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = typeof import.meta.dirname === 'string' ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output', 'unreal');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'zones'), { recursive: true });
mkdirSync(join(outDir, 'districts'), { recursive: true });
mkdirSync(join(outDir, 'actors'), { recursive: true });

// Author a 2.5D-enhanced variant of the chapel project: elevation on two zones,
// a skyline on the entrance, and a multi-level cellar.
const chapel25D: WorldProject = {
  ...chapelProject,
  mode: 'dungeon',
  zones: chapelProject.zones.map((z, i) => {
    if (i === 0) {
      return {
        ...z,
        elevation: 0,
        skylineRef: 'asset-chapel-skyline',
        parallaxLayers: [
          { id: 'far-clouds', depth: 100, assetRef: 'asset-clouds', scrollFactor: 0.05 },
          { id: 'mid-hills', depth: 50, assetRef: 'asset-hills', scrollFactor: 0.3 },
        ],
      };
    }
    if (i === 1) {
      return {
        ...z,
        elevation: -3,
        elevationRange: { floor: -5, ceiling: -1 },
      };
    }
    return z;
  }),
};

console.log('=== Chapel Threshold → Unreal Dogfood Export ===\n');
console.log(`Project: ${chapel25D.name}`);
console.log(`Mode: ${chapel25D.mode}`);
console.log(`Zones: ${chapel25D.zones.length}`);
console.log();

const result = exportToUnreal(chapel25D);

if (!result.success) {
  console.error('EXPORT FAILED — validation errors:');
  for (const err of result.errors) {
    console.error(`  [${err.path}] ${err.message}`);
  }
  process.exit(1);
}

const { contentPack, warnings, fidelity } = result;

console.log('--- Export Results ---\n');
console.log(`Zones: ${contentPack.Zones.length}`);
console.log(`Districts: ${contentPack.Districts.length}`);
console.log(`Actors: ${contentPack.Actors.All.length}`);
console.log(`Connections: ${contentPack.Connections.length}`);
console.log(
  `World Partition: ${contentPack.WorldPartition.CellsX} × ${contentPack.WorldPartition.CellsY} cells @ ${contentPack.WorldPartition.CellSizeCm} cm each (source mode: ${contentPack.WorldPartition.SourceMode})`,
);
console.log(`Fidelity: ${fidelity.summary.losslessPercent}% lossless (${fidelity.summary.total} entries)`);

console.log('\n--- Zone Z-axis sanity (2.5D) ---');
for (const z of contentPack.Zones) {
  const rangeStr = z.ElevationRangeCm
    ? ` range ${z.ElevationRangeCm.FloorCm}..${z.ElevationRangeCm.CeilingCm} cm`
    : '';
  const parallaxStr = z.ParallaxLayers ? ` | ${z.ParallaxLayers.length} parallax` : '';
  const skyStr = z.SkylineAssetId ? ` | skyline=${z.SkylineAssetId}` : '';
  console.log(`  ${z.Id}: OriginCm=(${z.OriginCm.X}, ${z.OriginCm.Y}, ${z.OriginCm.Z}), Elevation=${z.ElevationCm}cm${rangeStr}${parallaxStr}${skyStr}`);
}

// F-4641d61e: print-only Z-axis logs used to exit 0 when a converter zeroed
// elevation or dropped parallax. Gate those fields. WORLD_FORGE_FORCE_UNREAL_25D_FAIL
// mutates the pack so the subprocess test can fire the gate without a live bug.
if (process.env.WORLD_FORGE_FORCE_UNREAL_25D_FAIL === '1') {
  for (const z of contentPack.Zones) {
    z.ElevationCm = 0;
    z.ElevationRangeCm = undefined;
    z.ParallaxLayers = undefined;
    z.SkylineAssetId = undefined;
  }
}

const fails: string[] = [];
function assert25d(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`    ✓ ${label}`);
  } else {
    fails.push(label);
    console.log(`    ✗ ${label}${detail ? ': ' + detail : ''}`);
  }
}

const zone0 = contentPack.Zones[0];
assert25d(zone0 != null, 'zone_0_present');
if (zone0) {
  assert25d(
    zone0.SkylineAssetId === 'asset-chapel-skyline',
    'zone_0_skyline_survives',
    `expected asset-chapel-skyline, got ${zone0.SkylineAssetId ?? 'missing'}`,
  );
  assert25d(
    Array.isArray(zone0.ParallaxLayers) && zone0.ParallaxLayers.length === 2,
    'zone_0_parallax_survives',
    `expected 2 parallax layers, got ${zone0.ParallaxLayers?.length ?? 0}`,
  );
}

// i===1 is the authored multi-level cellar analogue (elevation -3 m → -300 cm).
const cellar = contentPack.Zones[1];
assert25d(cellar != null, 'cellar_zone_present');
if (cellar) {
  assert25d(
    cellar.ElevationCm === -300,
    'cellar_elevation_cm',
    `expected -300, got ${cellar.ElevationCm}`,
  );
  assert25d(cellar.ElevationRangeCm != null, 'cellar_elevation_range_present');
  if (cellar.ElevationRangeCm) {
    assert25d(
      cellar.ElevationRangeCm.FloorCm === -500,
      'cellar_floor_cm',
      `expected -500, got ${cellar.ElevationRangeCm.FloorCm}`,
    );
    assert25d(
      cellar.ElevationRangeCm.CeilingCm === -100,
      'cellar_ceiling_cm',
      `expected -100, got ${cellar.ElevationRangeCm.CeilingCm}`,
    );
  }
}

if (fails.length > 0) {
  console.error(`\n2.5D gate failed (${fails.length}): ${fails.join(', ')}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('\n--- Warnings ---');
  for (const w of warnings) console.log(`  - ${w}`);
}

// Write pack layout
writeFileSync(join(outDir, 'pack.json'), JSON.stringify(contentPack.Meta, null, 2));
writeFileSync(join(outDir, 'world-partition.json'), JSON.stringify(contentPack.WorldPartition, null, 2));
writeFileSync(join(outDir, 'connections.json'), JSON.stringify(contentPack.Connections, null, 2));
writeFileSync(join(outDir, 'fidelity.json'), JSON.stringify(fidelity, null, 2));
writeFileSync(join(outDir, 'actors', 'manifest.json'), JSON.stringify(contentPack.Actors, null, 2));

for (const zone of contentPack.Zones) {
  writeFileSync(join(outDir, 'zones', `${sanitize(zone.Id)}.json`), JSON.stringify(zone, null, 2));
}
for (const district of contentPack.Districts) {
  writeFileSync(join(outDir, 'districts', `${sanitize(district.Id)}.json`), JSON.stringify(district, null, 2));
}

console.log(`\nWrote UnrealContentPack to ${outDir}/`);

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
