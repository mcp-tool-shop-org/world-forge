#!/usr/bin/env node
// check-pack.mjs — F-c3504879: SHIP_GATE D actually runs `npm pack --dry-run`.
// Asserts each published workspace tarball contains dist/, README.md, and LICENSE.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');
const required = ['README.md', 'LICENSE'];

function packListing(pkgDir) {
  const raw = execSync('npm pack --dry-run --json', {
    cwd: pkgDir,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(raw);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const files = Array.isArray(entry?.files) ? entry.files : [];
  return files.map((f) => (typeof f === 'string' ? f : f.path)).filter(Boolean);
}

let failed = 0;
const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, 'package.json')))
  .map((d) => d.name);

for (const name of dirs) {
  const pkgDir = join(packagesDir, name);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  if (pkg.private) continue;
  console.log(`pack ${pkg.name}`);
  let files;
  try {
    files = packListing(pkgDir);
  } catch (err) {
    console.error(`  FAIL npm pack --dry-run: ${err instanceof Error ? err.message : err}`);
    failed += 1;
    continue;
  }
  const missing = [];
  const claimsDist = Array.isArray(pkg.files) && pkg.files.some((f) => f === 'dist' || f === 'dist/');
  if (claimsDist && !files.some((p) => p === 'dist' || p.startsWith('dist/'))) {
    missing.push('dist/ (listed in files but not in the tarball)');
  }
  for (const need of required) {
    if (!files.includes(need)) missing.push(need);
  }
  if (existsSync(join(pkgDir, 'LICENSE')) && !files.includes('LICENSE')) {
    missing.push('LICENSE');
  }
  if (missing.length > 0) {
    console.error(`  FAIL missing: ${missing.join(', ')}`);
    failed += 1;
  } else {
    console.log(`  ok ${files.length} files`);
  }
}

if (failed > 0) {
  console.error(`check-pack: ${failed} package(s) failed`);
  process.exit(1);
}
console.log(`check-pack: ${dirs.length} package(s) ok`);
