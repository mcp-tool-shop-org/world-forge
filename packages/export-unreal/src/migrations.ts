/**
 * migrations.ts — UE-FT-008 Schema versioning + migration framework.
 *
 * As the Unreal content pack structure evolves, older packs on disk must still
 * load cleanly. This module owns two jobs:
 *   1. Parse/compare pack format versions (semver major.minor.patch).
 *   2. Walk a migration chain to bring an older pack's Meta up to the current
 *      format version, applying each step's pure transform in order.
 *
 * Versioning rules (keep in sync with README):
 *   - **Major bump** — required field added/removed, or field semantics change
 *     in a way that a loader must see to handle correctly.
 *   - **Minor bump** — optional field added. Old loaders can ignore it; new
 *     loaders may read it if present.
 *   - **Patch bump** — clarifications, doc-only changes.
 *
 * Today only one migration edge exists: `1.0.0 → 1.1.0` (no-op; the `Signature`
 * field introduced by UE-FT-007 is optional, so nothing to rewrite). The
 * framework is deliberately in place so the next bump has a home to land in.
 */

import type { UnrealPackMeta } from './export.js';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export interface VersionCompareResult {
  /** Signed comparison: < 0 means `a` older than `b`; 0 equal; > 0 newer. */
  cmp: number;
  sameMajor: boolean;
}

/**
 * Parse a semver string into components. Returns `undefined` on malformed
 * input (missing, non-string, doesn't match `N.N.N`). Pre-release and build
 * metadata are intentionally rejected — the pack format is strict semver.
 */
export function parseSemVer(value: unknown): SemVer | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return undefined;
  return { major, minor, patch };
}

/** Compare two semver tuples. */
export function compareSemVer(a: SemVer, b: SemVer): VersionCompareResult {
  if (a.major !== b.major) return { cmp: a.major - b.major, sameMajor: false };
  if (a.minor !== b.minor) return { cmp: a.minor - b.minor, sameMajor: true };
  return { cmp: a.patch - b.patch, sameMajor: true };
}

/**
 * A single migration step. Each migration is a pure function that takes a
 * pack's `Meta` at version `from` and returns it rewritten at version `to`.
 * Steps MUST be pure — no I/O, no time, no randomness — so a migration chain
 * is deterministic and replay-safe.
 */
export interface Migration {
  from: string;
  to: string;
  migrate: (meta: UnrealPackMeta) => UnrealPackMeta;
}

/**
 * The migration chain. Ordered from oldest to newest. Each entry's `to` must
 * match the next entry's `from` — `buildMigrationChain` enforces this.
 *
 * v1.0.0 → v1.1.0: UE-FT-007 adds an optional `Signature` field. Old packs
 * have no signature and don't need one; the migration is a no-op that only
 * stamps the new FormatVersion so downstream dispatchers route correctly.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  {
    from: '1.0.0',
    to: '1.1.0',
    migrate: (meta) => ({ ...meta, FormatVersion: '1.1.0' }),
  },
];

export interface MigrationWarning {
  kind: 'forward-compat';
  fromVersion: string;
  toVersion: string;
  message: string;
}

export interface MigrationResult {
  meta: UnrealPackMeta;
  appliedSteps: Array<{ from: string; to: string }>;
  warnings: MigrationWarning[];
}

export interface MigrationError {
  code: 'UNKNOWN_MAJOR' | 'MALFORMED_VERSION' | 'NO_PATH';
  fromVersion: string;
  toVersion: string;
  message: string;
}

/**
 * Migrate a pack's Meta from its declared FormatVersion to `targetVersion`.
 *
 * Rules:
 *   - Same version → no-op (returns Meta unchanged, no warnings).
 *   - Older minor on same major → walk the chain; each step's transform runs.
 *   - Newer minor on same major → return Meta as-is with a forward-compat
 *     warning. Minor bumps are purely additive, so a forward-read is safe
 *     but the loader should surface the gap.
 *   - Different major (either direction) → hard error. Major bumps signal
 *     structural change the loader hasn't been built to handle.
 *   - Malformed / missing version → hard error. Pack is unusable.
 */
export function migratePack(
  meta: UnrealPackMeta,
  targetVersion: string,
): MigrationResult | MigrationError {
  const target = parseSemVer(targetVersion);
  if (!target) {
    return {
      code: 'MALFORMED_VERSION',
      fromVersion: String(meta.FormatVersion),
      toVersion: targetVersion,
      message: `Target version "${targetVersion}" is not valid semver (expected N.N.N).`,
    };
  }

  const current = parseSemVer(meta.FormatVersion);
  if (!current) {
    return {
      code: 'MALFORMED_VERSION',
      fromVersion: String(meta.FormatVersion),
      toVersion: targetVersion,
      message: `Pack FormatVersion "${String(meta.FormatVersion)}" is not valid semver (expected N.N.N).`,
    };
  }

  const cmp = compareSemVer(current, target);

  // Same version — no-op fast path.
  if (cmp.cmp === 0) {
    return { meta, appliedSteps: [], warnings: [] };
  }

  // Different major in either direction — refuse to load.
  if (!cmp.sameMajor) {
    return {
      code: 'UNKNOWN_MAJOR',
      fromVersion: meta.FormatVersion,
      toVersion: targetVersion,
      message:
        `Pack FormatVersion ${meta.FormatVersion} has a different major than supported ${targetVersion}. ` +
        `Loader cannot safely read across major boundaries — re-export the pack with a compatible exporter.`,
    };
  }

  // Newer minor — forward-compat. Return Meta as-is with a warning.
  if (cmp.cmp > 0) {
    return {
      meta,
      appliedSteps: [],
      warnings: [
        {
          kind: 'forward-compat',
          fromVersion: meta.FormatVersion,
          toVersion: targetVersion,
          message:
            `Pack FormatVersion ${meta.FormatVersion} is newer than loader target ${targetVersion}. ` +
            `Loading on a best-effort basis — fields added in the newer version may be ignored.`,
        },
      ],
    };
  }

  // Older minor — walk the chain from current → target.
  const applicable = MIGRATIONS.filter((m) => {
    const from = parseSemVer(m.from);
    const to = parseSemVer(m.to);
    if (!from || !to) return false;
    if (from.major !== current.major) return false;
    // A step is applicable if it moves us strictly forward and stays within the target.
    const fromCmp = compareSemVer(from, current);
    const toCmp = compareSemVer(to, target);
    return fromCmp.cmp >= 0 && toCmp.cmp <= 0;
  });

  let working: UnrealPackMeta = meta;
  const appliedSteps: Array<{ from: string; to: string }> = [];
  for (const step of applicable) {
    const stepFrom = parseSemVer(step.from);
    const workingCurrent = parseSemVer(working.FormatVersion);
    if (!stepFrom || !workingCurrent) continue;
    if (compareSemVer(workingCurrent, stepFrom).cmp !== 0) continue; // chain broken
    working = step.migrate(working);
    appliedSteps.push({ from: step.from, to: step.to });
  }

  const finalVersion = parseSemVer(working.FormatVersion);
  if (!finalVersion || compareSemVer(finalVersion, target).cmp !== 0) {
    return {
      code: 'NO_PATH',
      fromVersion: meta.FormatVersion,
      toVersion: targetVersion,
      message:
        `No migration path from ${meta.FormatVersion} to ${targetVersion}. ` +
        `Ended at ${String(working.FormatVersion)} after ${appliedSteps.length} step(s).`,
    };
  }

  return { meta: working, appliedSteps, warnings: [] };
}

/** Type guard distinguishing a successful migration from an error. */
export function isMigrationError(
  value: MigrationResult | MigrationError,
): value is MigrationError {
  return (value as MigrationError).code !== undefined;
}
