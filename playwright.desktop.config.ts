import { defineConfig } from '@playwright/test';

// The INSTALLED Windows app (see e2e-desktop/app.ts). Run: npm run e2e:desktop
// Needs the app installed for the current user and real network access to YGOPRODeck.
export default defineConfig({
  testDir: 'e2e-desktop',
  outputDir: 'test-results-desktop',
  workers: 1,
  reporter: [['list']],
  timeout: 240_000,
  expect: { timeout: 20_000 },
});
