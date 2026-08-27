import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  // Materialize chapel-project.json from the schema fixture so e2e does not
  // depend on a tracked file sitting under gitignored dogfood/output/.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5200',
    headless: true,
    // F-03e207f6: retries is 0, so 'on-first-retry' traces never fire.
    // Capture a picture + trace of a failed editor boot for CI.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev --workspace=@world-forge/editor -- --port 5200',
    port: 5200,
    // F-b48f68c3: never trust a leftover :5200 process in CI.
    reuseExistingServer: !process.env.CI,
    // F-06cc860c: 15s is below Playwright's 60s default and fails a cold CI
    // Vite compile before any spec runs. 120s on CI, 60s locally.
    timeout: process.env.CI ? 120_000 : 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
