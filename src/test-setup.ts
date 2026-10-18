// jsdom has no IndexedDB; unit tests use an in-memory implementation. Real-browser
// persistence is covered by the Playwright E2E suite.
import 'fake-indexeddb/auto';

// Process-wide state that one spec must not leave behind for the next: the desktop platform hooks and bridge
// hints (a leftover host opener makes every later `window.open` expectation fail), and the per-tab storage the
// AI settings read the API key from.
import { afterEach, vi } from 'vitest';
import { setBridgeHints } from './app/core/ai/chatgpt';
import { installPlatformHooks } from './app/shared/platform-hooks';

afterEach(() => {
  installPlatformHooks({});
  setBridgeHints(null);
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});
