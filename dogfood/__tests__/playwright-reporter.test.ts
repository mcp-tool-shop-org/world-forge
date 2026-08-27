// playwright-reporter.test.ts — regression coverage for F-861ff80c.
//
// playwright.config.ts used to omit `reporter`, so Playwright 1.59 defaulted
// to 'dot' in CI / 'list' locally — never 'html'. CI uploads playwright-report/
// on failure; the HTML reporter is what materializes that directory. Without
// it the artifact zip's gallery half is empty by construction even though
// screenshot/trace already write PNGs + trace.zip under test-results/.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import playwrightConfig from '../../playwright.config.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('playwright.config.ts reporter (F-861ff80c)', () => {
    it("includes the html reporter so playwright-report/ materializes", () => {
        const reporter = playwrightConfig.reporter;
        expect(reporter, 'playwright.config.ts must set reporter').toBeDefined();
        const list = Array.isArray(reporter) ? reporter : [reporter];
        const names = list.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
        expect(names).toContain('html');
    });

    it("pins html open:'never' in source so a local run does not pop the gallery", () => {
        const src = readFileSync(resolve(ROOT, 'playwright.config.ts'), 'utf8');
        expect(src).toMatch(/\[\s*['"]html['"]\s*,\s*\{\s*open:\s*['"]never['"]/);
    });
});
