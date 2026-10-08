import { defineConfig } from '@playwright/test';

const port = 4310;

// Runs against the locally installed Microsoft Edge; no Playwright browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'msedge',
    trace: 'retain-on-failure',
  },
  projects: [
    // Default suite: external card source is mocked (see e2e/fixtures.ts).
    { name: 'e2e', testIgnore: /real-network\.spec\.ts/ },
    // Explicit run against the real YGOPRODeck source.
    { name: 'real-network', testMatch: /real-network\.spec\.ts/ },
  ],
  webServer: {
    command: `npx ng serve --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
