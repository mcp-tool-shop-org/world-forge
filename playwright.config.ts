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
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev --workspace=@world-forge/editor -- --port 5200',
    port: 5200,
    // F-b48f68c3: never trust a leftover :5200 process in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
