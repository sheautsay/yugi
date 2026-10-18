import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from './open-external';
import { hasExternalOpener, installPlatformHooks } from './platform-hooks';
import { saveTextFile } from './save-file';

afterEach(() => {
  installPlatformHooks({});
  vi.restoreAllMocks();
});

describe('CR-010 platform hooks (browser behaviour is unchanged without hooks)', () => {
  it('openExternal opens a new tab with noopener,noreferrer by default', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(hasExternalOpener()).toBe(false);
    openExternal('https://example.com/a');
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
  });

  it('openExternal goes to the host when one is installed and never touches window.open', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const hostOpen = vi.fn().mockResolvedValue(undefined);
    installPlatformHooks({ openExternal: hostOpen });
    expect(hasExternalOpener()).toBe(true);
    openExternal('https://example.com/b');
    expect(hostOpen).toHaveBeenCalledWith('https://example.com/b');
    expect(open).not.toHaveBeenCalled();
  });

  it('a failing host opener does not throw into the page', async () => {
    installPlatformHooks({ openExternal: () => Promise.reject(new Error('blocked')) });
    expect(() => openExternal('https://example.com/c')).not.toThrow();
    await Promise.resolve();
  });

  it('saveTextFile downloads through an anchor by default', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    saveTextFile('a.json', '{}');
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('saveTextFile uses the host dialog when installed', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const save = vi.fn().mockResolvedValue(true);
    installPlatformHooks({ saveText: save });
    saveTextFile('b.json', '{"x":1}', 'application/json');
    expect(save).toHaveBeenCalledWith('b.json', '{"x":1}', 'application/json');
    expect(click).not.toHaveBeenCalled();
  });

  it('saveTextFile falls back to the browser download when the host dialog fails, so an export is never lost', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:y');
    installPlatformHooks({ saveText: () => Promise.reject(new Error('no dialog')) });
    saveTextFile('c.json', '{}');
    await new Promise((r) => setTimeout(r, 0));
    expect(click).toHaveBeenCalledTimes(1);
  });
});
