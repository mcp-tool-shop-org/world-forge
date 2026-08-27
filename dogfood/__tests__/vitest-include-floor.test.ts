// vitest-include-floor.test.ts — guards vitest.config.ts's `include` globs
// against silent narrowing (F-005 / F-d517b17e).
//
// vitest.config.ts used to set `passWithNoTests: true` next to a single
// monorepo-wide include glob. A typo in that glob (e.g. `*.test.ts` ->
// `*.tests.ts`) would make `vitest run` match zero files and exit 0 — "all
// tests pass" when nothing ran. `passWithNoTests` has been removed (vitest's
// own default already fails a zero-match run), which closes the
// zero-match / total-collapse case. This test is the softer, complementary
// check: it walks the filesystem independently of vitest's own file
// collection and asserts every package still contributes test files, so a
// glob that narrows to SOME files (silently dropping just one package,
// say) — but not all the way to zero — still gets caught.
//
// This file lives under dogfood/ specifically so it is picked up by the
// `dogfood/**/*.test.ts` include glob added alongside this fix, independent
// of the `packages/*/src/**/*.test.ts` glob it is checking up on.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

function isDirectory(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
}

/** Manual recursive walk (no glob dependency) for `*.test.ts` under `dir`. */
function findTestFiles(dir: string, matches: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return matches;
    }
    for (const entry of entries) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        const full = join(dir, entry);
        if (isDirectory(full)) {
            findTestFiles(full, matches);
        } else if (entry.endsWith('.test.ts')) {
            matches.push(full);
        }
    }
    return matches;
}

describe('vitest include-glob floor (F-005)', () => {
    it('every packages/*/src package still contributes test files', () => {
        const packagesDir = resolve(ROOT, 'packages');
        const packageDirs = readdirSync(packagesDir).filter((name) =>
            isDirectory(join(packagesDir, name, 'src')),
        );

        // Known-good at time of writing: schema, export-ai-rpg, export-godot,
        // export-unreal, renderer-2d, editor.
        expect(packageDirs.length).toBeGreaterThanOrEqual(6);

        for (const pkg of packageDirs) {
            const found = findTestFiles(join(packagesDir, pkg, 'src'));
            expect(
                found.length,
                `packages/${pkg}/src has zero *.test.ts files — either it genuinely lost ` +
                    `all coverage, or vitest.config.ts's include glob silently stopped matching it.`,
            ).toBeGreaterThan(0);
        }
    });

    it('total *.test.ts count under packages/*/src has not collapsed', () => {
        const packagesDir = resolve(ROOT, 'packages');
        const packageDirs = readdirSync(packagesDir).filter((name) => isDirectory(join(packagesDir, name)));
        let total = 0;
        for (const pkg of packageDirs) {
            total += findTestFiles(join(packagesDir, pkg, 'src')).length;
        }
        // Known-good count at time of writing: 136. The floor is set well
        // below that so ordinary test consolidation doesn't false-positive,
        // but a glob-typo collapse (matches ~0) or a whole-package loss is
        // still caught well before it reaches vitest's own zero-match floor.
        expect(total).toBeGreaterThanOrEqual(100);
    });

    it('dogfood/**/*.test.ts is itself reachable (this file proves it)', () => {
        // If this test is running at all, the `dogfood/**/*.test.ts` glob in
        // vitest.config.ts matched at least this file — a tautology-shaped
        // assertion, but a deliberate one: it documents the dependency this
        // whole test file has on that glob still being correct, right next
        // to the checks that would otherwise be the only ones watching it.
        expect(findTestFiles(resolve(ROOT, 'dogfood')).length).toBeGreaterThan(0);
    });

    it('parsed include globs still match src-root tests (F-4db80511)', () => {
        // The on-disk walk above stays green if include is narrowed to
        // packages/*/src/__tests__/**/*.test.ts, because every package still
        // has files under src/. Parse the actual include and match it.
        const globs = parseVitestInclude(readFileSync(resolve(ROOT, 'vitest.config.ts'), 'utf-8'));
        expect(globs.length).toBeGreaterThan(0);

        const srcRootTests = [
            'packages/editor/src/modal-guards.test.ts',
            'packages/editor/src/speed-panel-actions.test.ts',
        ];
        for (const rel of srcRootTests) {
            expect(
                matchesAnyGlob(rel, globs),
                `${rel} must match vitest.config.ts include (got ${JSON.stringify(globs)})`,
            ).toBe(true);
        }

        const packagesDir = resolve(ROOT, 'packages');
        const packageDirs = readdirSync(packagesDir).filter((name) =>
            isDirectory(join(packagesDir, name, 'src')),
        );
        for (const pkg of packageDirs) {
            const found = findTestFiles(join(packagesDir, pkg, 'src'));
            const matched = found.filter((full) =>
                matchesAnyGlob(toPosix(relative(ROOT, full)), globs),
            );
            expect(
                matched.length,
                `packages/${pkg}/src has *.test.ts on disk but none match include ${JSON.stringify(globs)}`,
            ).toBeGreaterThan(0);
        }
    });

    it('a glob narrowed to __tests__/ would miss src-root tests (documents F-4db80511)', () => {
        const narrowed = ['packages/*/src/__tests__/**/*.test.ts'];
        expect(matchesAnyGlob('packages/editor/src/modal-guards.test.ts', narrowed)).toBe(false);
        expect(matchesAnyGlob('packages/editor/src/speed-panel-actions.test.ts', narrowed)).toBe(false);
        expect(matchesAnyGlob('packages/editor/src/__tests__/hotkeys.test.ts', narrowed)).toBe(true);
    });
});

function parseVitestInclude(source: string): string[] {
    const m = source.match(/include:\s*\[([\s\S]*?)\]/);
    if (!m) throw new Error('could not parse include: [...] from vitest.config.ts');
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

function toPosix(p: string): string {
    return p.replace(/\\/g, '/');
}

function globToRegExp(glob: string): RegExp {
    let pattern = '';
    let i = 0;
    while (i < glob.length) {
        if (glob[i] === '*' && glob[i + 1] === '*') {
            if (glob[i + 2] === '/') {
                pattern += '(?:.*/)?';
                i += 3;
            } else {
                pattern += '.*';
                i += 2;
            }
        } else if (glob[i] === '*') {
            pattern += '[^/]*';
            i += 1;
        } else if ('\\^$+?.()|[]{}'.includes(glob[i])) {
            pattern += `\\${glob[i]}`;
            i += 1;
        } else {
            pattern += glob[i];
            i += 1;
        }
    }
    return new RegExp(`^${pattern}$`);
}

function matchesAnyGlob(relPosix: string, globs: string[]): boolean {
    return globs.some((g) => globToRegExp(g).test(relPosix));
}
