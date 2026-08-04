#!/usr/bin/env node
/**
 * sync-version.mjs — stamp the current workspace version into README.md,
 * and (on request) keep its "N tests" figure and sub-package versions honest.
 *
 * Why: the README carries a prominent "vX.Y.Z — N tests, ..." line just under
 * the badges. Historically (pre-v4.4) it was hand-edited every release, and at
 * the v4.3.0 → v4.4.0 bump it drifted (INF-B-001). This script is the version
 * authority for that line — root package.json is authoritative, README is
 * generated.
 *
 * SCOPE (read this before assuming more than the code does): this script
 * owns exactly two figures — the README's version token and, on request, its
 * test-count figure. A prior audit (wave-1, F-006) found a coordinator brief
 * describing this script as stamping "root package.json → all 6 packages and
 * the README block" — that write authority does not exist in this file and
 * never has; it has no code path that touches any packages/<pkg>/package.json.
 * Whatever keeps those 6 files' versions at root's value (they all currently
 * match, verified while writing this note) is a different mechanism, owned by
 * whichever domain owns those files. `--check` now verifies (read-only) that
 * they still match root, specifically so that class of drift is CAUGHT
 * somewhere instead of silently assumed — but this script still has no write
 * path for it, on purpose: writing those files is not this file's job, and
 * inventing that job here would just move the "who owns this" question
 * rather than answer it.
 *
 * Contract:
 *   - The README must contain a single block delimited by
 *     <!-- version:start --> ... <!-- version:end -->.
 *   - That block's vX.Y.Z token and (with --sync-tests) "N tests" figure are
 *     rewritten. Everything else inside the block — package count, mode
 *     count, short descriptor — is preserved, still hand-curated per release.
 *
 * Usage:
 *   node scripts/sync-version.mjs
 *     Rewrite the vX.Y.Z token if it has drifted. Fast (no test execution) —
 *     this is the mode wired to npm `prebuild`, so it runs on every
 *     `npm run build` without taxing it.
 *
 *   node scripts/sync-version.mjs --check
 *     Exit non-zero if ANY of the following has drifted: the version token,
 *     the "N tests" figure (checked against a REAL measurement, not a
 *     literal), or any packages/*\/package.json version no longer matching
 *     root. This is the CI gate — run it as its own explicit step, not via
 *     prebuild (see "why measuring is not part of the default write" below).
 *
 *   node scripts/sync-version.mjs --sync-tests
 *     Re-measure the real vitest test count (runs the full suite) and stamp
 *     BOTH the version token and the "N tests" figure. This is the manual,
 *     deliberate "make the README honest before a release" step — the "write"
 *     side the coordinator asked to keep manual rather than wiring into
 *     prebuild.
 *
 * Why measuring the test count is not part of the default/prebuild write:
 * getting a REAL count means actually running the suite
 * (`vitest run --reporter=json`), which is not free — measured directly
 * while building this capability: ~4s wall-clock for a single representative
 * package alone (packages/export-unreal/src — 7 files, 122 tests, most of it
 * fixed per-invocation startup cost), and ~5s for the FULL suite (136 files,
 * ~2450 tests at time of writing). Five seconds is fast in absolute terms,
 * but `prebuild` fires before EVERY `npm run build`, including routine local
 * and incremental builds — taxing all of those with a full test run for a
 * figure that only needs to be current at release time is the wrong trade
 * regardless of how fast that run is; it duplicates what CI's own `npm test`
 * step already does, on a hook that has nothing to do with testing. So:
 * `--check` pays the measurement cost (as an explicit, opt-in CI step, never
 * via prebuild), the default write does not,
 * and `--sync-tests` is the explicit manual trigger for the write side. An
 * honest gated number beats an ungated one either way.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pkgPath = resolve(repoRoot, 'package.json');
const readmePath = resolve(repoRoot, 'README.md');

const CHECK = process.argv.includes('--check');
const SYNC_TESTS = process.argv.includes('--sync-tests');

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

// ── Version token ─────────────────────────────────────────────
// Replace the first vX.Y.Z(-prerelease)? token inside the block. This
// preserves the surrounding "— N tests, ..." copy, which stays hand-curated
// per release except for the "N tests" figure itself (see below).
const versionRegex = /v\d+\.\d+\.\d+(?:-[\w.]+)?/;
if (!versionRegex.test(inner)) {
  console.error('[sync-version] version block does not contain a vX.Y.Z token to replace.');
  process.exit(2);
}
let nextInner = inner.replace(versionRegex, `v${version}`);
const versionDrifted = nextInner !== inner;

// ── Test count ────────────────────────────────────────────────
// Only measured when asked (--check or --sync-tests) — see the header for
// why this doesn't run on every bare invocation.
const testsRegex = /(\d+)(\s+tests\b)/;
let testCountDrifted = false;
let measuredCount = null;

if (CHECK || SYNC_TESTS) {
  if (!testsRegex.test(inner)) {
    console.error('[sync-version] version block does not contain an "N tests" figure to check/replace.');
    process.exit(2);
  }
  measuredCount = measureTestCount();
  const withRealCount = nextInner.replace(testsRegex, (_m, _n, suffix) => `${measuredCount}${suffix}`);
  testCountDrifted = withRealCount !== nextInner;
  if (SYNC_TESTS) nextInner = withRealCount;
}

// ── Sub-package version consistency (read-only — --check only) ──
// See the SCOPE note above: this script verifies but does not write these.
const subPackageMismatches = CHECK ? checkSubPackageVersions() : [];

// ── Report / gate / write ────────────────────────────────────────
if (CHECK) {
  const problems = [];
  if (versionDrifted) {
    problems.push(`version token is stale — expected v${version}.`);
  }
  if (testCountDrifted) {
    const [, currentCount] = inner.match(testsRegex) ?? [];
    problems.push(
      `test count is stale — README says "${currentCount ?? '?'} tests", vitest reports ${measuredCount}.`
    );
  }
  for (const m of subPackageMismatches) {
    problems.push(`sub-package version drift: ${m}`);
  }

  if (problems.length === 0) {
    console.log(
      `[sync-version] README matches package.json v${version}` +
        (measuredCount !== null ? ` and vitest's real count (${measuredCount} tests)` : '') +
        `. All packages/*/package.json versions match root.`
    );
    process.exit(0);
  }

  console.error('[sync-version] drift detected:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    versionDrifted || testCountDrifted
      ? '\nRun: node scripts/sync-version.mjs' + (testCountDrifted ? ' --sync-tests' : '')
      : ''
  );
  process.exit(1);
}

if (nextInner === inner) {
  console.log(`[sync-version] README already matches v${version}${SYNC_TESTS ? ' and the measured test count' : ''}.`);
  process.exit(0);
}

writeFileSync(readmePath, before + nextInner + after);
console.log(
  `[sync-version] README.md stamped: version v${version}` +
    (SYNC_TESTS ? `, test count ${measuredCount}.` : '.')
);

// ── Helpers ───────────────────────────────────────────────────

/**
 * Run the full vitest suite with the JSON reporter and return the real
 * `numTotalTests` count. Invoked via `node <resolved vitest.mjs path>`
 * (execFileSync + process.execPath), NOT `npx vitest` / a shell string —
 * `npx`/`vitest` resolve to `.cmd` shims on Windows that execFile can't run
 * without `shell: true`, and a shell string reintroduces the
 * unquoted-interpolation class of bug this repo's own dogfood harness was
 * just fixed for (see dogfood/run-godot-smoke.ts). Resolving vitest's own
 * bin entry and handing it to `node` directly sidesteps both problems on
 * every platform.
 */
function measureTestCount() {
  let vitestBin;
  try {
    vitestBin = fileURLToPath(import.meta.resolve('vitest/vitest.mjs'));
  } catch (err) {
    console.error(`[sync-version] could not resolve vitest to measure the test count: ${err.message}`);
    process.exit(2);
  }

  let stdout;
  try {
    stdout = execFileSync(
      process.execPath,
      [vitestBin, 'run', '--reporter=json', '--config', resolve(repoRoot, 'vitest.config.ts')],
      { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err) {
    // vitest exits non-zero when tests fail, but still emits a full JSON
    // report on stdout — a failing suite still HAS a real test count, so
    // fall back to whatever stdout the failed run produced rather than
    // treating a red suite as "could not measure."
    stdout = err.stdout;
    if (!stdout) {
      console.error(`[sync-version] running vitest to measure the test count failed with no output: ${err.message}`);
      process.exit(2);
    }
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error('[sync-version] could not parse vitest --reporter=json output while measuring the test count.');
    process.exit(2);
  }
  if (typeof report.numTotalTests !== 'number') {
    console.error('[sync-version] vitest JSON report had no numeric numTotalTests field.');
    process.exit(2);
  }
  return report.numTotalTests;
}

/** Read-only: list packages/*\/package.json versions that don't match root. */
function checkSubPackageVersions() {
  const packagesDir = resolve(repoRoot, 'packages');
  const mismatches = [];
  if (!existsSync(packagesDir)) return mismatches;

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const subPkgPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(subPkgPath)) continue;
    let subPkg;
    try {
      subPkg = JSON.parse(readFileSync(subPkgPath, 'utf8'));
    } catch (err) {
      mismatches.push(`packages/${entry.name}/package.json could not be parsed: ${err.message}`);
      continue;
    }
    if (subPkg.version !== version) {
      mismatches.push(`packages/${entry.name} is v${subPkg.version ?? '(missing)'}, expected v${version}`);
    }
  }
  return mismatches;
}
