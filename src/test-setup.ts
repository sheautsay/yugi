// jsdom has no IndexedDB; unit tests use an in-memory implementation. Real-browser
// persistence is covered by the Playwright E2E suite.
import 'fake-indexeddb/auto';
