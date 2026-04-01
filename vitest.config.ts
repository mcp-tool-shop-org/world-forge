import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    // passWithNoTests: allow packages with no test files yet (e.g. editor UI)
    // to not block the monorepo test suite during incremental development.
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
