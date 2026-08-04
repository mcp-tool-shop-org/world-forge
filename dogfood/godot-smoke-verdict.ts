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
 */
export function computeOverallPass(inputs: VerdictInputs): boolean {
    return (
        inputs.smokeVerdict === 'PASS' &&
        inputs.godotExitCode === 0 &&
        inputs.resourceWarnings.length === 0 &&
        inputs.fails.length === 0
    );
}

/** Derive the self-reported verdict string, falling back to exit-code inference when absent. */
export function deriveSmokeVerdict(kvPairs: Record<string, string>, godotExitCode: number): string {
    return kvPairs.smoke_verdict ?? (godotExitCode === 0 ? 'PASS' : 'FAIL');
}
