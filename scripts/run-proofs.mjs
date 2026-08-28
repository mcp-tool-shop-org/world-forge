#!/usr/bin/env node
// run-proofs.mjs — F-973863f9: one command for the four proof runners.
// Missing Godot is SKIPPED (exit 0); engine-fail is fail.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const runners = [
  { id: 'multi-target', file: 'dogfood/multi-target-export-proof.ts' },
  { id: 'unreal-smoke', file: 'dogfood/run-unreal-smoke.ts' },
  { id: 'ai-rpg-smoke', file: 'dogfood/run-ai-rpg-smoke.ts' },
  { id: 'godot-smoke', file: 'dogfood/run-godot-smoke.ts', godotOptional: true },
];

function runOne(runner) {
  const result = spawnSync('npx', ['tsx', runner.file], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: true,
  });
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (runner.godotOptional && (result.status === 2 || /godot_bin_missing|GODOT_BIN/i.test(out))) {
    return { id: runner.id, verdict: 'SKIPPED', detail: 'Godot binary missing' };
  }
  if (result.status === 0) return { id: runner.id, verdict: 'PASS', detail: '' };
  return { id: runner.id, verdict: 'FAIL', detail: `exit ${result.status}` };
}

const rows = runners.map(runOne);
console.log('id'.padEnd(16), 'verdict');
for (const r of rows) {
  console.log(r.id.padEnd(16), r.verdict, r.detail);
}
if (rows.some((r) => r.verdict === 'FAIL')) process.exit(1);
process.exit(0);
