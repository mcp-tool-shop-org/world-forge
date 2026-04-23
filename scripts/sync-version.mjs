#!/usr/bin/env node
/**
 * sync-version.mjs — stamp the current workspace version into README.md.
 *
 * Why: the README carries a prominent "vX.Y.Z — N tests, ..." line just under
 * the badges. Historically (pre-v4.4) it was hand-edited every release, and at
 * the v4.3.0 → v4.4.0 bump it drifted (INF-B-001). This script is the single
 * source of truth — root package.json is authoritative, README is generated.
 *
 * Contract:
 *   - The README must contain a single block delimited by
 *     <!-- version:start --> ... <!-- version:end -->.
 *   - That block is replaced wholesale. Any hand-edits inside it are lost.
 *   - Everything outside the block (tests count, package count, mode count,
 *     short descriptor) is preserved — we only rewrite the vX.Y.Z token.
 *
 * Usage:
 *   node scripts/sync-version.mjs           # rewrite if drifted
 *   node scripts/sync-version.mjs --check   # exit non-zero if drifted (CI gate)
 *
 * Invoked automatically via npm `prebuild` so `npm run build` at the repo root
 * always refreshes the README before producing artifacts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pkgPath = resolve(repoRoot, 'package.json');
const readmePath = resolve(repoRoot, 'README.md');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('[sync-version] root package.json has no version field');
  process.exit(2);
}

const readme = readFileSync(readmePath, 'utf8');
const START = '<!-- version:start -->';
const END = '<!-- version:end -->';
const startIdx = readme.indexOf(START);
const endIdx = readme.indexOf(END);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error(
    `[sync-version] README.md is missing the <!-- version:start --> / <!-- version:end --> block.\n` +
      `Add one around the "v${version} — ..." line so this script can keep it current.`
  );
  process.exit(2);
}

const before = readme.slice(0, startIdx + START.length);
const after = readme.slice(endIdx);
const inner = readme.slice(startIdx + START.length, endIdx);

// Replace the first vX.Y.Z(-prerelease)? token inside the block. This preserves
// the surrounding "— N tests, ..." copy which is hand-curated per release.
const versionRegex = /v\d+\.\d+\.\d+(?:-[\w.]+)?/;
if (!versionRegex.test(inner)) {
  console.error('[sync-version] version block does not contain a vX.Y.Z token to replace.');
  process.exit(2);
}
const nextInner = inner.replace(versionRegex, `v${version}`);

if (nextInner === inner) {
  // Nothing to do — already in sync.
  if (process.argv.includes('--check')) {
    console.log(`[sync-version] README matches package.json v${version}.`);
  }
  process.exit(0);
}

if (process.argv.includes('--check')) {
  console.error(
    `[sync-version] README.md is stale. Expected v${version} but block contains a different version.\n` +
      `Run: node scripts/sync-version.mjs`
  );
  process.exit(1);
}

writeFileSync(readmePath, before + nextInner + after);
console.log(`[sync-version] README.md version stamped to v${version}.`);
