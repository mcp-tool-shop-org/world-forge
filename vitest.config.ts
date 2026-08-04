import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // F-005 / F-d517b17e: two locations, not one monorepo-wide glob wearing a
    // single point of failure. `packages/*/src/**/*.test.ts` covers the 6
    // packages (all have real coverage as of this fix); `dogfood/**/*.test.ts`
    // covers unit tests for the dogfood harness scripts themselves (e.g.
    // godot-smoke-verdict.test.ts), which used to have nowhere to run from.
    include: ['packages/*/src/**/*.test.ts', 'dogfood/**/*.test.ts'],
    // `passWithNoTests` used to be `true` here. That meant a typo'd include
    // glob (e.g. `*.test.ts` -> `*.tests.ts`) would make `vitest run` match
    // ZERO files and still exit 0 — "all tests pass" when nothing ran, and
    // `npm run verify` would report green with the suite silently skipped.
    // vitest's own default (`passWithNoTests: false`) already fails a
    // zero-match run, which is exactly the protection this needs — removed
    // rather than left `true`, now that every package has real tests.
    // dogfood/__tests__/vitest-include-floor.test.ts is the belt-and-braces
    // check for the softer case (glob narrows to SOME files, not zero).
    setupFiles: ['./vitest.setup.ts'],
  },
});
