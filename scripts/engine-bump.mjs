/**
 * engine-bump.mjs — Weekly within-major bump helper for `@ai-rpg-engine/*` dependencies.
 *
 * Scans root `package.json` and all `packages/*\/package.json` manifests for
 * `@ai-rpg-engine/*` ranges, checks published npm releases, bumps all declared
 * engine ranges together to the newest stable release within the current major,
 * updates the lockfile + installed engine tree, and regenerates derived engine
 * lists (`scripts/gen-engine-lists.mjs`).
 *
 * Newer major releases are NEVER applied automatically; they are reported so a
 * human can review breaking changes and run a deliberate upgrade.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(HERE, '..');
const ENGINE_SCOPE = '@ai-rpg-engine/';
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const DEFAULT_ENGINE_REPO = 'mcp-tool-shop-org/ai-rpg-engine';
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * Parse a strict `major.minor.patch` stable version (no prerelease/build tags).
 * Returns null for prereleases or malformed strings so candidate selection never
 * picks an alpha/beta/rc release.
 */
export function parseStableSemver(input) {
  if (typeof input !== 'string') return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
  };
}

/** Compare two parsed SemVer triples: negative if a < b, 0 if equal, positive if a > b. */
export function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/** Extract the base version triple and optional range prefix from a dependency specifier. */
export function parseDeclaredRange(range) {
  if (typeof range !== 'string') {
    throw new Error(`Invalid dependency range: ${String(range)}`);
  }
  const match = /^([~^]|>=)?\s*(\d+\.\d+\.\d+)$/.exec(range.trim());
  if (!match) {
    throw new Error(`Unsupported engine dependency range format: "${range}"`);
  }
  const parsed = parseStableSemver(match[2]);
  if (!parsed) {
    throw new Error(`Invalid semver triple in range "${range}"`);
  }
  return {
    prefix: match[1] ?? '^',
    version: parsed,
  };
}

/**
 * Discover every manifest (`package.json` and `packages/*\/package.json`) that
 * declares `@ai-rpg-engine/*` dependencies, and verify all share one major/floor.
 */
export function findEnginePackagesInWorkspace(repoRoot = DEFAULT_REPO_ROOT) {
  const candidateRelPaths = ['package.json'];
  const packagesDir = resolve(repoRoot, 'packages');
  if (existsSync(packagesDir)) {
    const entries = readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dirName of entries) {
      const rel = `packages/${dirName}/package.json`;
      if (existsSync(resolve(repoRoot, rel))) {
        candidateRelPaths.push(rel);
      }
    }
  }

  const files = [];
  const allPackages = new Set();
  let currentFloor = null;
  let currentMajor = null;

  for (const relPath of candidateRelPaths) {
    const absPath = resolve(repoRoot, relPath);
    const raw = readFileSync(absPath, 'utf-8');
    const manifest = JSON.parse(raw);
    const hits = [];

    for (const section of DEP_SECTIONS) {
      const record = manifest[section];
      if (!record || typeof record !== 'object') continue;
      for (const pkgName of Object.keys(record).sort()) {
        if (!pkgName.startsWith(ENGINE_SCOPE)) continue;
        const range = record[pkgName];
        const parsed = parseDeclaredRange(range);
        if (currentFloor === null) {
          currentFloor = parsed.version.raw;
          currentMajor = parsed.version.major;
        } else if (parsed.version.major !== currentMajor) {
          throw new Error(
            `Inconsistent major across workspace: ${relPath} ${section}.${pkgName} declares ${range} (expected major ${currentMajor})`,
          );
        } else if (compareSemver(parsed.version, parseStableSemver(currentFloor)) < 0) {
          currentFloor = parsed.version.raw;
        }
        allPackages.add(pkgName);
        hits.push({ section, pkgName, currentRange: range, parsed });
      }
    }

    if (hits.length > 0) {
      files.push({ relPath, absPath, raw, manifest, hits });
    }
  }

  if (files.length === 0 || currentFloor === null || currentMajor === null) {
    throw new Error(`No ${ENGINE_SCOPE}* dependencies found under ${repoRoot}`);
  }

  return {
    files,
    allEnginePackages: [...allPackages].sort(),
    currentFloor,
    currentMajor,
  };
}

/**
 * Given the current floor (`X.Y.Z`) and `{ [pkgName]: string[] }` of published
 * npm versions for every declared `@ai-rpg-engine/*` package, compute whether a
 * within-major bump exists and whether a newer major release exists.
 */
export function selectBumpPlan({ currentVersion, publishedByPackage }) {
  const currentParsed = parseStableSemver(currentVersion);
  if (!currentParsed) {
    throw new Error(`Invalid currentVersion "${currentVersion}"`);
  }

  const pkgNames = Object.keys(publishedByPackage).sort();
  if (pkgNames.length === 0) {
    throw new Error('publishedByPackage must include at least one package');
  }

  // Only bump to versions published across EVERY declared @ai-rpg-engine/* package
  // so a partial publish never splits the workspace across versions.
  const perPackageSets = pkgNames.map((name) => {
    const set = new Set();
    for (const ver of publishedByPackage[name] ?? []) {
      const stable = parseStableSemver(ver);
      if (stable) set.add(stable.raw);
    }
    return set;
  });

  const commonVersions = [...perPackageSets[0]].filter((ver) =>
    perPackageSets.every((s) => s.has(ver)),
  );

  const withinMajorCandidates = commonVersions
    .map(parseStableSemver)
    .filter((v) => v !== null && v.major === currentParsed.major && compareSemver(v, currentParsed) > 0)
    .sort(compareSemver);

  const targetParsed = withinMajorCandidates.length > 0
    ? withinMajorCandidates[withinMajorCandidates.length - 1]
    : null;

  // Report newer major if published in common OR across any engine package so
  // operators are always warned when a new major line exists on npm.
  const allStableAcrossAny = new Set();
  for (const s of perPackageSets) {
    for (const ver of s) allStableAcrossAny.add(ver);
  }
  const commonMajorCandidates = commonVersions
    .map(parseStableSemver)
    .filter((v) => v !== null && v.major > currentParsed.major)
    .sort(compareSemver);
  const anyMajorCandidates = [...allStableAcrossAny]
    .map(parseStableSemver)
    .filter((v) => v !== null && v.major > currentParsed.major)
    .sort(compareSemver);

  const newerMajorParsed = commonMajorCandidates.length > 0
    ? commonMajorCandidates[commonMajorCandidates.length - 1]
    : anyMajorCandidates.length > 0
      ? anyMajorCandidates[anyMajorCandidates.length - 1]
      : null;

  const targetVersion = targetParsed ? targetParsed.raw : null;
  const newerMajorVersion = newerMajorParsed ? newerMajorParsed.raw : null;
  const status = targetVersion !== null ? 'bumped' : newerMajorVersion !== null ? 'major-only' : 'noop';

  let compareUrl = null;
  if (status === 'bumped') {
    compareUrl = `https://github.com/${DEFAULT_ENGINE_REPO}/compare/v${currentParsed.raw}...v${targetVersion}`;
  } else if (status === 'major-only') {
    compareUrl = `https://github.com/${DEFAULT_ENGINE_REPO}/compare/v${currentParsed.raw}...v${newerMajorVersion}`;
  }

  return {
    status,
    currentVersion: currentParsed.raw,
    currentMajor: currentParsed.major,
    targetVersion,
    newerMajorVersion,
    compareUrl,
    packages: pkgNames,
  };
}

/** Fetch all published version strings for an npm package via the npm registry JSON API. */
export async function defaultFetchPublishedVersions(pkgName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName).replace(/^%40/, '@')}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.npm.install-v1+json, application/json' },
  });
  if (!res.ok) {
    throw new Error(`npm registry lookup for ${pkgName} failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || typeof data !== 'object' || !data.versions || typeof data.versions !== 'object') {
    throw new Error(`npm registry response for ${pkgName} had no versions map`);
  }
  return Object.keys(data.versions);
}

/** Refresh `package-lock.json` and installed `@ai-rpg-engine/*` tree on disk without touching unrelated packages. */
export function defaultRegenerateLockfile(repoRoot, enginePackages) {
  const lockPath = resolve(repoRoot, 'package-lock.json');
  const existingEngineLockPkgs = new Set(enginePackages);
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
    for (const key of Object.keys(lock.packages ?? {})) {
      if (key.startsWith(`node_modules/${ENGINE_SCOPE}`)) {
        existingEngineLockPkgs.add(key.slice('node_modules/'.length));
      }
    }
  }
  const pkgsToUpdate = [...existingEngineLockPkgs].sort();
  execFileSync(
    NPM_BIN,
    ['update', ...pkgsToUpdate, '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  execFileSync(
    NPM_BIN,
    ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  );
}

/** Run `scripts/gen-engine-lists.mjs` to keep generated schema/exporter lists aligned. */
export function defaultRegenerateEngineLists(repoRoot) {
  const genScript = resolve(repoRoot, 'scripts/gen-engine-lists.mjs');
  if (!existsSync(genScript)) {
    throw new Error(`Missing list generator script: ${genScript}`);
  }
  execFileSync(process.execPath, [genScript], { cwd: repoRoot, stdio: 'inherit' });
}

/** Format the issue title and markdown body opened or updated by `.github/workflows/engine-bump.yml`. */
export function formatEngineBumpIssue({
  plan,
  repository = 'mcp-tool-shop-org/world-forge',
  branch = 'chore/engine-bump',
}) {
  if (plan.status === 'bumped') {
    const title = `Engine dependencies behind: @ai-rpg-engine/* ${plan.currentVersion} -> ${plan.targetVersion}`;
    const lines = [
      `The weekly check found a newer \`@ai-rpg-engine/*\` release within major \`${plan.currentMajor}.x\`.`,
      '',
      '| field | value |',
      '|---|---|',
      `| previous pin | \`^${plan.currentVersion}\` |`,
      `| bumped pin | \`^${plan.targetVersion}\` |`,
      `| packages updated | ${plan.packages.length} |`,
      `| engine compare | ${plan.compareUrl} |`,
      '',
      'A bump branch with updated `package.json`, `package-lock.json`, and regenerated engine lists has been pushed.',
      'Open the pull request here after checking that CI is green:',
      '',
      `  https://github.com/${repository}/pull/new/${branch}`,
    ];
    if (plan.newerMajorVersion) {
      lines.push(
        '',
        `> Note: a newer major release (\`${plan.newerMajorVersion}\`) is also published on npm. Within-major automation never bumps across majors; review \`${DEFAULT_ENGINE_REPO}\` release notes and upgrade manually when ready.`,
      );
    }
    return { title, body: `${lines.join('\n')}\n` };
  }

  if (plan.status === 'major-only') {
    const title = `New @ai-rpg-engine/* major release available (${plan.newerMajorVersion}; pinned at ${plan.currentVersion})`;
    const lines = [
      `A newer \`@ai-rpg-engine/*\` major release (\`${plan.newerMajorVersion}\`) is published on npm.`,
      '',
      '| field | value |',
      '|---|---|',
      `| current pin | \`^${plan.currentVersion}\` |`,
      `| newest major on npm | \`${plan.newerMajorVersion}\` |`,
      `| engine compare | ${plan.compareUrl} |`,
      '',
      `Automatic weekly bumps only move within the current major (\`${plan.currentMajor}.x\`) and refused this major jump.`,
      'Bump the ranges manually and re-verify the exporter contract checklist when ready to adopt the new major.',
    ];
    return { title, body: `${lines.join('\n')}\n` };
  }

  return {
    title: `Engine dependencies current at ${plan.currentVersion}`,
    body: `All ${plan.packages.length} \`@ai-rpg-engine/*\` dependencies are already on \`${plan.currentVersion}\`.\n`,
  };
}

/**
 * End-to-end bump routine.
 * Accepts dependency overrides for fast deterministic unit tests.
 */
export async function applyEngineBump({
  repoRoot = DEFAULT_REPO_ROOT,
  dryRun = false,
  fetchVersions = defaultFetchPublishedVersions,
  regenerateLockfile = defaultRegenerateLockfile,
  regenerateEngineLists = defaultRegenerateEngineLists,
} = {}) {
  const workspace = findEnginePackagesInWorkspace(repoRoot);
  const publishedEntries = await Promise.all(
    workspace.allEnginePackages.map(async (pkgName) => [pkgName, await fetchVersions(pkgName)]),
  );
  const publishedByPackage = Object.fromEntries(publishedEntries);
  const plan = selectBumpPlan({
    currentVersion: workspace.currentFloor,
    publishedByPackage,
  });

  if (plan.status !== 'bumped' || dryRun) {
    return {
      ...plan,
      dryRun,
      updatedFiles: [],
    };
  }

  const nextRange = `^${plan.targetVersion}`;
  const updatedFiles = [];

  for (const file of workspace.files) {
    let changed = false;
    const nextManifest = structuredClone(file.manifest);
    for (const hit of file.hits) {
      if (nextManifest[hit.section][hit.pkgName] !== nextRange) {
        nextManifest[hit.section][hit.pkgName] = nextRange;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(file.absPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf-8');
      updatedFiles.push(file.relPath);
    }
  }

  regenerateLockfile(repoRoot, workspace.allEnginePackages, plan.targetVersion);
  regenerateEngineLists(repoRoot, plan.targetVersion);

  return {
    ...plan,
    dryRun: false,
    updatedFiles,
  };
}

function parseArgs(argv) {
  let dryRun = false;
  let jsonOut = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--json-out') {
      jsonOut = argv[++i] ?? null;
      if (!jsonOut) throw new Error('--json-out requires a file path');
    } else if (arg.startsWith('--json-out=')) {
      jsonOut = arg.slice('--json-out='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { dryRun, jsonOut, help };
}

async function main() {
  const { dryRun, jsonOut, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log('Usage: node scripts/engine-bump.mjs [--dry-run] [--json-out <path>]');
    process.exit(0);
  }
  const result = await applyEngineBump({ repoRoot: DEFAULT_REPO_ROOT, dryRun });
  if (jsonOut) {
    writeFileSync(resolve(DEFAULT_REPO_ROOT, jsonOut), `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  }
  console.log(
    `[engine-bump] status=${result.status} current=${result.currentVersion}` +
      (result.targetVersion ? ` target=${result.targetVersion}` : '') +
      (result.newerMajorVersion ? ` newerMajor=${result.newerMajorVersion}` : ''),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`[engine-bump] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
