/**
 * migrations.ts — Godot pack format versioning + migration framework.
 *
 * Versioning rules (keep in sync with README and GODOT_PACK_FORMAT_VERSION):
 *   - **Major bump** — required field added/removed, or field semantics change
 *     in a way that a loader must see to handle correctly.
 *   - **Minor bump** — optional field added. Old loaders can ignore it; new
 *     loaders may read it if present.
 *   - **Patch bump** — clarifications, doc-only changes.
 *
 * When the pack shape changes, bump GODOT_PACK_FORMAT_VERSION and add a
 * migration step here. Today's only edge is 1.0.0 → 1.1.0 (additive:
 * `files`, `zoneGates`; identity transform plus defaulted new fields).
 */

import { GODOT_PACK_FORMAT_VERSION, type GodotContentPack, type GodotPackMeta } from './export.js';

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
 * input. Pre-release and build metadata are rejected — the pack format is
 * strict `N.N.N`.
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

export interface Migration {
    from: string;
    to: string;
    migrate: (pack: GodotContentPack) => GodotContentPack;
}

/**
 * The migration chain, oldest to newest. Each entry's `to` must match the
 * next entry's `from`.
 *
 * v1.0.0 → v1.1.0: additive `files` (resourcePath → .tres body) and
 * `zoneGates` on the JSON pack. Old packs have neither; default them empty
 * and stamp the new formatVersion.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
    {
        from: '1.0.0',
        to: '1.1.0',
        migrate: (pack) => ({
            ...pack,
            files: pack.files ?? {},
            zoneGates: pack.zoneGates ?? [],
            meta: { ...pack.meta, formatVersion: '1.1.0' },
        }),
    },
];

export interface MigrationWarning {
    kind: 'forward-compat';
    fromVersion: string;
    toVersion: string;
    message: string;
}

export interface MigrationResult {
    pack: GodotContentPack;
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
 * Migrate a Godot content pack from its declared meta.formatVersion to
 * `targetVersion` (defaults to the exporter's current constant).
 */
export function migrateGodotPack(
    pack: GodotContentPack,
    targetVersion: string = GODOT_PACK_FORMAT_VERSION,
): MigrationResult | MigrationError {
    const target = parseSemVer(targetVersion);
    if (!target) {
        return {
            code: 'MALFORMED_VERSION',
            fromVersion: String(pack.meta.formatVersion),
            toVersion: targetVersion,
            message: `Target version "${targetVersion}" is not valid semver (expected N.N.N).`,
        };
    }

    const current = parseSemVer(pack.meta.formatVersion);
    if (!current) {
        return {
            code: 'MALFORMED_VERSION',
            fromVersion: String(pack.meta.formatVersion),
            toVersion: targetVersion,
            message: `Pack formatVersion "${String(pack.meta.formatVersion)}" is not valid semver (expected N.N.N).`,
        };
    }

    const cmp = compareSemVer(current, target);

    if (cmp.cmp === 0) {
        return { pack, appliedSteps: [], warnings: [] };
    }

    if (!cmp.sameMajor) {
        return {
            code: 'UNKNOWN_MAJOR',
            fromVersion: pack.meta.formatVersion,
            toVersion: targetVersion,
            message:
                `Pack formatVersion ${pack.meta.formatVersion} has a different major than supported ${targetVersion}. ` +
                `Loader cannot safely read across major boundaries — re-export the pack with a compatible exporter.`,
        };
    }

    if (cmp.cmp > 0) {
        return {
            pack,
            appliedSteps: [],
            warnings: [
                {
                    kind: 'forward-compat',
                    fromVersion: pack.meta.formatVersion,
                    toVersion: targetVersion,
                    message:
                        `Pack formatVersion ${pack.meta.formatVersion} is newer than loader target ${targetVersion}. ` +
                        `Loading on a best-effort basis — fields added in the newer version may be ignored.`,
                },
            ],
        };
    }

    const applicable = MIGRATIONS.filter((m) => {
        const from = parseSemVer(m.from);
        const to = parseSemVer(m.to);
        if (!from || !to) return false;
        if (from.major !== current.major) return false;
        const fromCmp = compareSemVer(from, current);
        const toCmp = compareSemVer(to, target);
        return fromCmp.cmp >= 0 && toCmp.cmp <= 0;
    });

    let working: GodotContentPack = pack;
    const appliedSteps: Array<{ from: string; to: string }> = [];
    for (const step of applicable) {
        const stepFrom = parseSemVer(step.from);
        const workingCurrent = parseSemVer(working.meta.formatVersion);
        if (!stepFrom || !workingCurrent) continue;
        if (compareSemVer(workingCurrent, stepFrom).cmp !== 0) continue;
        working = step.migrate(working);
        appliedSteps.push({ from: step.from, to: step.to });
    }

    const finalVersion = parseSemVer(working.meta.formatVersion);
    if (!finalVersion || compareSemVer(finalVersion, target).cmp !== 0) {
        return {
            code: 'NO_PATH',
            fromVersion: pack.meta.formatVersion,
            toVersion: targetVersion,
            message:
                `No migration path from ${pack.meta.formatVersion} to ${targetVersion}. ` +
                `Ended at ${String(working.meta.formatVersion)} after ${appliedSteps.length} step(s).`,
        };
    }

    return { pack: working, appliedSteps, warnings: [] };
}

export function isMigrationError(
    value: MigrationResult | MigrationError,
): value is MigrationError {
    return (value as MigrationError).code !== undefined;
}

/** Re-export for loaders that only need to stamp meta. */
export type { GodotPackMeta };
