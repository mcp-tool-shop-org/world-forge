/**
 * godot-smoke-verdict.ts — pure parsing + verdict logic for run-godot-smoke.ts.
 *
 * Split out from run-godot-smoke.ts so this logic is unit-testable without
 * shelling out to a real Godot binary. Nothing in this file has a side
 * effect (no fs, no child_process, no process.exit) — it only transforms
 * strings it is handed — so it is safe to import from a vitest test.
 * run-godot-smoke.ts imports and uses these same functions; this file is not
 * a parallel reimplementation.
 */

export interface ParsedSmokeOutput {
    passes: string[];
    fails: string[];
    kvPairs: Record<string, string>;
}

/**
 * Parse `smoke_load_world.gd`'s structured stdout/stderr into pass/fail
 * lines and `key=value` pairs (e.g. `smoke_verdict=PASS`, `zone_count=5`).
 */
export function parseSmokeOutput(godotOutput: string): ParsedSmokeOutput {
    const lines = godotOutput.split('\n').map((l) => l.trim()).filter(Boolean);

    const kvPairs: Record<string, string> = {};
    const passes: string[] = [];
    const fails: string[] = [];

    for (const line of lines) {
        if (line.startsWith('PASS: ')) passes.push(line.slice(6));
        else if (line.startsWith('FAIL: ')) fails.push(line.slice(6));
        else if (line.includes('=') && !line.startsWith('[') && !line.startsWith('  ')) {
            const [key, ...rest] = line.split('=');
            kvPairs[key] = rest.join('=');
        }
    }

    return { passes, fails, kvPairs };
}

/** Detect missing-resource / script-error lines anywhere in raw Godot output. */
export function findResourceWarnings(godotOutput: string): string[] {
    const lines = godotOutput.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.filter((l) =>
        l.includes('Failed loading resource') ||
        l.includes('Cannot load source code') ||
        (l.includes('res://') && l.includes('not found')) ||
        l.includes('SCRIPT ERROR') ||
        l.includes('Cannot open file') ||
        l.match(/ERROR.*load/i),
    );
}

export interface VerdictInputs {
    /** The GDScript's own self-reported verdict string, if present (`smoke_verdict=...`). */
    smokeVerdict: string;
    godotExitCode: number;
    /** Missing-resource / script-error lines detected in raw output. */
    resourceWarnings: string[];
    /**
     * Individual `FAIL: ` lines already parsed from stdout by
     * {@link parseSmokeOutput} (plus any synthetic entries the caller has
     * appended, e.g. for resource warnings).
     */
    fails: string[];
    /**
     * Individual `PASS: ` lines parsed from captured stdout+stderr.
     * Empty captured output (or stderr-only engine noise) must not pass:
     * overallPass requires at least one of these (F-9830ed99).
     */
    passes: string[];
}

/**
 * The Godot smoke test's overall pass/fail verdict.
 *
 * F-004 fix: `smokeVerdict` and `godotExitCode` both
 * originate from the SAME source — `smoke_load_world.gd`'s `_finish()`
 * prints `smoke_verdict=` and calls `quit()` in the same code block — so on
 * their own they are one signal read twice, not two independent checks. This
 * function requires `fails.length === 0` as a fourth, independently-parsed
 * condition, so a GDScript that emits individual `FAIL: ` lines but
 * mis-reports (or is edited to unconditionally report) `smoke_verdict=PASS`
 * is still caught here rather than trusted at face value.
 *
 * F-9830ed99: also require `passes.length > 0`. Empty or stderr-only
 * capture plus exit 0 used to yield VERDICT PASS because a missing
 * `smoke_verdict` was inferred as PASS and no PASS: lines were required.
 */
export function computeOverallPass(inputs: VerdictInputs): boolean {
    return (
        inputs.smokeVerdict === 'PASS' &&
        inputs.godotExitCode === 0 &&
        inputs.resourceWarnings.length === 0 &&
        inputs.fails.length === 0 &&
        inputs.passes.length > 0
    );
}

/**
 * Derive the self-reported verdict string.
 *
 * F-9830ed99: a missing `smoke_verdict` token is FAIL, never inferred PASS
 * from exit 0. Empty/stderr-only Godot output plus a clean exit used to
 * fall through to PASS here.
 */
export function deriveSmokeVerdict(kvPairs: Record<string, string>, _godotExitCode: number): string {
    return kvPairs.smoke_verdict ?? 'FAIL';
}

export interface ProofCounts {
    zoneCount: number;
    entityCount: number;
    itemCount: number;
    spawnPointCount: number;
    transitionCount: number;
    navLinkCount: number;
    zoneIds: readonly string[];
}

/**
 * F-a6ef9bdd: connect GDScript-printed kvPairs to the TypeScript proof world.
 * smoke_load_world.gd has its own EXPECTED_* constants; a lockstep edit of
 * those constants plus a converter that drops a zone still PASSed because the
 * TS runner never compared kvPairs to proofProject. Push mismatches onto the
 * same `fails` list that feeds computeOverallPass.
 */
export function assertKvAgainstProof(
    kvPairs: Record<string, string>,
    expected: ProofCounts,
    fails: string[],
): void {
    const checks: Array<[string, number]> = [
        ['zone_count', expected.zoneCount],
        ['entity_count', expected.entityCount],
        ['item_count', expected.itemCount],
        ['spawn_point_count', expected.spawnPointCount],
        ['transition_count', expected.transitionCount],
        ['nav_link_count', expected.navLinkCount],
    ];
    for (const [key, want] of checks) {
        const got = kvPairs[key];
        if (got !== String(want)) {
            fails.push(`${key} vs proofProject: expected ${want}, got ${got ?? 'missing'}`);
        }
    }
    const reported = new Set(
        (kvPairs.zone_ids ?? '').split(',').map((id) => id.trim()).filter(Boolean),
    );
    const source = new Set(expected.zoneIds);
    const missing = [...source].filter((id) => !reported.has(id));
    const extra = [...reported].filter((id) => !source.has(id));
    if (missing.length > 0 || extra.length > 0) {
        fails.push(
            `zone_ids vs proofProject: expected ${[...source].sort().join(',')}, got ${kvPairs.zone_ids ?? 'missing'}`,
        );
    }
}
