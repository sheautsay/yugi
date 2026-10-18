import { bridgeHints, setBridgeHints } from './core/ai/chatgpt';
import { hasExternalOpener, installPlatformHooks } from './shared/platform-hooks';

// Angular's unit-test builder runs Vitest with `isolate: false`, so module-level state and jsdom storage survive from
// one spec file to the next inside a worker. src/test-setup.ts resets them after every test; these two tests (which
// run in this order) fail if that reset is ever removed.
describe('test isolation (src/test-setup.ts)', () => {
  it('leaves process-wide state behind on purpose', () => {
    installPlatformHooks({ openExternal: async () => undefined });
    setBridgeHints({ down: 'x', preflight: 'y', managed: true });
    sessionStorage.setItem('ygo-combo-assistant.claude-api-key', 'left-behind');
    localStorage.setItem('left', 'behind');
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(hasExternalOpener()).toBe(true);
  });

  it('starts the next test from a clean slate', () => {
    expect(hasExternalOpener()).toBe(false);
    expect(bridgeHints().managed).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(vi.isMockFunction(window.open)).toBe(false);
  });
});
