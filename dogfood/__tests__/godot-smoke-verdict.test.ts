// godot-smoke-verdict.test.ts — regression coverage for the Godot smoke
// wrapper's parsing + verdict logic (F-004 / dogfood/run-godot-smoke.ts:186).
//
// Before this fix, `overallPass` was:
//   smokeVerdict === 'PASS' && godotExitCode === 0 && resourceWarnings.length === 0
// — it never looked at `fails`, even though `fails` was already parsed from
// individual `FAIL: ` lines a few lines earlier. A GDScript that printed
// several `FAIL: ...` lines but still reported `smoke_verdict=PASS` (or ran
// with exit 0 despite failures) would make the wrapper print "VERDICT: PASS"
// and write a receipt claiming the scene loaded cleanly.
//
// This suite exercises the "fails-only path" the coordinator asked to have
// covered: individual FAIL lines present, but smoke_verdict and exit code
// both self-report success. It also locks in the ordinary green and red
// paths so a future edit can't silently re-break either direction.

import { describe, it, expect } from 'vitest';
import {
    parseSmokeOutput,
    findResourceWarnings,
    computeOverallPass,
    deriveSmokeVerdict,
} from '../godot-smoke-verdict.js';

describe('parseSmokeOutput', () => {
    it('splits PASS:/FAIL:/key=value lines into their buckets', () => {
        const output = [
            'Godot Engine v4.4.stable',
            'PASS: zone_count matches',
            'FAIL: entity_count mismatch',
            'PASS: nav_links present',
            'zone_count=5',
            'smoke_verdict=PASS',
        ].join('\n');

        const { passes, fails, kvPairs } = parseSmokeOutput(output);

        expect(passes).toEqual(['zone_count matches', 'nav_links present']);
        expect(fails).toEqual(['entity_count mismatch']);
        expect(kvPairs.zone_count).toBe('5');
        expect(kvPairs.smoke_verdict).toBe('PASS');
    });

    it('returns empty buckets for blank output', () => {
        const { passes, fails, kvPairs } = parseSmokeOutput('');
        expect(passes).toEqual([]);
        expect(fails).toEqual([]);
        expect(kvPairs).toEqual({});
    });
});

describe('findResourceWarnings', () => {
    it('flags missing-resource and script-error lines', () => {
        const output = [
            'Godot Engine v4.4.stable',
            'ERROR: Failed loading resource: res://entities/npc/missing.tscn',
            'SCRIPT ERROR: Parse Error',
            'PASS: zone_count matches',
        ].join('\n');
        expect(findResourceWarnings(output).length).toBeGreaterThanOrEqual(2);
    });

    it('finds nothing in clean output', () => {
        const output = ['Godot Engine v4.4.stable', 'PASS: zone_count matches', 'smoke_verdict=PASS'].join('\n');
        expect(findResourceWarnings(output)).toEqual([]);
    });
});

describe('deriveSmokeVerdict', () => {
    it('prefers the self-reported smoke_verdict when present', () => {
        expect(deriveSmokeVerdict({ smoke_verdict: 'FAIL' }, 0)).toBe('FAIL');
    });

    it('falls back to exit-code inference when smoke_verdict is absent', () => {
        expect(deriveSmokeVerdict({}, 0)).toBe('PASS');
        expect(deriveSmokeVerdict({}, 1)).toBe('FAIL');
    });
});

describe('computeOverallPass (F-004)', () => {
    it('passes when every signal agrees', () => {
        const pass = computeOverallPass({
            smokeVerdict: 'PASS',
            godotExitCode: 0,
            resourceWarnings: [],
            fails: [],
        });
        expect(pass).toBe(true);
    });

    it('THE FAILS-ONLY PATH: self-reported PASS + clean exit code, but a live FAIL: line — must fail', () => {
        // This is the exact scenario the audit's mutation proof described:
        // `_finish()` unconditionally prints `smoke_verdict=PASS` and calls
        // `quit(0)` regardless of `_failures.size()`, while the console still
        // shows real `FAIL: ` lines from individual assertions. Before the
        // fix this returned true; the whole point of F-004 is that it must
        // not.
        const pass = computeOverallPass({
            smokeVerdict: 'PASS',
            godotExitCode: 0,
            resourceWarnings: [],
            fails: ['entity_count mismatch: expected 4, got 3'],
        });
        expect(pass).toBe(false);
    });

    it('fails on a bad exit code even with a clean self-report', () => {
        const pass = computeOverallPass({
            smokeVerdict: 'PASS',
            godotExitCode: 1,
            resourceWarnings: [],
            fails: [],
        });
        expect(pass).toBe(false);
    });

    it('fails when resource warnings are present', () => {
        const pass = computeOverallPass({
            smokeVerdict: 'PASS',
            godotExitCode: 0,
            resourceWarnings: ['Failed loading resource: res://x.tscn'],
            fails: [],
        });
        expect(pass).toBe(false);
    });

    it('fails when the self-reported verdict is FAIL even with everything else clean', () => {
        const pass = computeOverallPass({
            smokeVerdict: 'FAIL',
            godotExitCode: 0,
            resourceWarnings: [],
            fails: [],
        });
        expect(pass).toBe(false);
    });
});
