// dogfood/chapel-threshold.ts — export the chapel fixture and write output files
// Run: npx tsx dogfood/chapel-threshold.ts
//
// INF-B-007 / F-2abb3406: generated files under dogfood/output/ are .gitignored
// and are NOT the e2e input. Playwright globalSetup (e2e/global-setup.ts) writes
// chapel-project.json from the schema chapel fixture at suite start. This script
// still writes the same filename as a local dogfood artifact; it must not be
// committed. chapel-export-result.json was an unreferenced leftover and is gone.
//
// If a future release wants snapshot regression, the work is:
//   1. Un-gitignore a named fixture path and document it as the e2e input, OR
//      keep generating it in Playwright globalSetup (current path).
//   2. Add a CI step that runs this dogfood script, then `git diff --exit-code`
//      against committed snapshots.
//   3. Add a documented refresh path (`npm run dogfood:refresh` or similar) so
//      intentional changes are a one-command regeneration, not a manual diff.

import { chapelProject } from '../packages/schema/src/__tests__/fixtures/chapel-authored.js';
import { exportToEngine } from '../packages/export-ai-rpg/src/export.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = typeof import.meta.dirname === 'string' ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
mkdirSync(outDir, { recursive: true });

// Also write the input project for reference
writeFileSync(join(outDir, 'chapel-project.json'), JSON.stringify(chapelProject, null, 2));

console.log('=== Chapel Threshold Dogfood Export ===\n');
console.log(`Project: ${chapelProject.name}`);
console.log(`Zones: ${chapelProject.zones.length}`);
console.log(`Districts: ${chapelProject.districts.length}`);
console.log(`Entities: ${chapelProject.entityPlacements.length}`);
console.log(`Items: ${chapelProject.itemPlacements.length}`);
console.log(`Connections: ${chapelProject.connections.length}`);
console.log(`Landmarks: ${chapelProject.landmarks.length}`);
console.log(`Spawn points: ${chapelProject.spawnPoints.length}`);
console.log(`Faction presences: ${chapelProject.factionPresences.length}`);
console.log(`Pressure hotspots: ${chapelProject.pressureHotspots.length}`);
console.log();

const result = exportToEngine(chapelProject);

if ('success' in result && result.success === false) {
  console.error('EXPORT FAILED — validation errors:');
  for (const err of result.errors) {
    console.error(`  [${err.path ?? '(root)'}] ${err.message}`);
  }
  process.exit(1);
}

// Type narrowing: if we get here, it's ExportResult
const { contentPack, manifest, packMeta, warnings } = result as import('../packages/export-ai-rpg/src/export.js').ExportResult;

console.log('--- Export Results ---\n');
console.log(`Zones exported: ${contentPack.zones.length}`);
console.log(`Districts exported: ${contentPack.districts.length}`);
console.log(`Entities exported: ${contentPack.entities.length}`);
console.log(`Items exported: ${contentPack.items.length}`);
console.log(`Dialogues exported: ${contentPack.dialogues.length}`);
console.log(`Player template: ${contentPack.playerTemplate ? contentPack.playerTemplate.name : 'none'}`);
console.log(`Build catalog: ${contentPack.buildCatalog ? `${contentPack.buildCatalog.archetypes.length} archetypes, ${contentPack.buildCatalog.traits.length} traits` : 'none'}`);
console.log(`Progression trees: ${contentPack.progressionTrees.length}`);
console.log();

if (warnings.length > 0) {
  console.log('--- Warnings ---\n');
  for (const w of warnings) {
    console.log(`  ⚠ ${w}`);
  }
  console.log();
}

// Write output files
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(outDir, 'pack-meta.json'), JSON.stringify(packMeta, null, 2));
writeFileSync(join(outDir, 'zones.json'), JSON.stringify(contentPack.zones, null, 2));
writeFileSync(join(outDir, 'districts.json'), JSON.stringify(contentPack.districts, null, 2));
writeFileSync(join(outDir, 'entities.json'), JSON.stringify(contentPack.entities, null, 2));
writeFileSync(join(outDir, 'items.json'), JSON.stringify(contentPack.items, null, 2));
writeFileSync(join(outDir, 'dialogues.json'), JSON.stringify(contentPack.dialogues, null, 2));
if (contentPack.playerTemplate) {
  writeFileSync(join(outDir, 'player-template.json'), JSON.stringify(contentPack.playerTemplate, null, 2));
}
if (contentPack.buildCatalog) {
  writeFileSync(join(outDir, 'build-catalog.json'), JSON.stringify(contentPack.buildCatalog, null, 2));
}
if (contentPack.progressionTrees.length > 0) {
  writeFileSync(join(outDir, 'progression-trees.json'), JSON.stringify(contentPack.progressionTrees, null, 2));
}

console.log('--- Output Files ---\n');
console.log(`  ${outDir}/chapel-project.json (input)`);
console.log(`  ${outDir}/manifest.json`);
console.log(`  ${outDir}/pack-meta.json`);
console.log(`  ${outDir}/zones.json`);
console.log(`  ${outDir}/districts.json`);
console.log(`  ${outDir}/entities.json`);
console.log(`  ${outDir}/items.json`);
console.log(`  ${outDir}/dialogues.json`);
if (contentPack.playerTemplate) console.log(`  ${outDir}/player-template.json`);
if (contentPack.buildCatalog) console.log(`  ${outDir}/build-catalog.json`);
if (contentPack.progressionTrees.length > 0) console.log(`  ${outDir}/progression-trees.json`);
console.log();

// --- Gap Analysis ---
// Compare what we exported vs what the engine expects

console.log('=== Gap Analysis: World Forge vs Engine Contract ===\n');

const gaps: string[] = [];

// Entities: engine expects baseStats + baseResources
for (const e of contentPack.entities) {
  if (!e.baseStats || Object.keys(e.baseStats).length === 0) {
    gaps.push(`Entity "${e.name}" has no baseStats`);
  }
  if (!e.baseResources || Object.keys(e.baseResources).length === 0) {
    gaps.push(`Entity "${e.name}" has no baseResources`);
  }
}

// Items: engine expects slot + rarity
for (const i of contentPack.items) {
  if (!i.slot) gaps.push(`Item "${i.name || i.id}" has no slot`);
  if (!i.rarity) gaps.push(`Item "${i.name || i.id}" has no rarity`);
}

// Dialogues: entity-dialogue binding
for (const e of chapelProject.entityPlacements) {
  if (e.dialogueId && !contentPack.dialogues.some((d) => d.id === e.dialogueId)) {
    gaps.push(`Entity "${e.entityId}" references dialogue "${e.dialogueId}" but it was not exported`);
  }
}

// Player template
if (!contentPack.playerTemplate) {
  gaps.push('No player template exported — engine expects player setup');
}

// Build catalog
if (!contentPack.buildCatalog) {
  gaps.push('No build catalog exported — engine expects character creation data');
} else {
  if (contentPack.buildCatalog.archetypes.length === 0) gaps.push('Build catalog has no archetypes');
  if (contentPack.buildCatalog.backgrounds.length === 0) gaps.push('Build catalog has no backgrounds');
}

// Progression trees
if (contentPack.progressionTrees.length === 0) {
  gaps.push('No progression trees exported — engine expects character advancement');
}

// Test-only fault injection (dogfood/__tests__/chapel-threshold-gap-gate.test.ts):
// lets a regression test exercise the "gap reintroduced" branch of the exit
// gate (F-239f17d3) deterministically, via a real subprocess run.
// WORLD_FORGE_FORCE_DOGFOOD_GAP is never set during a normal run.
if (process.env.WORLD_FORGE_FORCE_DOGFOOD_GAP === '1') {
  gaps.push('Test-injected gap (WORLD_FORGE_FORCE_DOGFOOD_GAP) — exercises the exit-code gate for regression coverage');
}

if (gaps.length > 0) {
  // F-683e8222: a red run used to look successful — gaps went to stdout,
  // then `=== Done ===`, then exit 1 with an empty stderr. Skip Done, put
  // the list + a one-line fix hint on stderr.
  console.error(`Found ${gaps.length} gaps:\n`);
  for (const g of gaps) {
    console.error(`  * ${g}`);
  }
  console.error(
    '\nFix: restore the missing engine-contract fields listed above (see dogfood/WALKTHROUGH.md) so this export has zero gaps, then re-run.',
  );
  process.exit(1);
}

console.log('No gaps found — full engine handshake!');
console.log('\n=== Done ===');
