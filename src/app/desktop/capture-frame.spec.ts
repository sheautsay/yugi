// B4: the frame format between the host's `capture_game_window` and the page (see src-tauri/src/capture.rs).
import { CAPTURE_SHORTCUT_EVENT, DesktopApis, parseFrame } from './desktop-apis';
import { installDesktop, uninstallDesktop } from './install-desktop';
import { canCaptureGame, isCompactWindow, platformHooks } from '../shared/platform-hooks';

function frame(width: number, height: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8 + width * height * 4);
  const view = new DataView(buffer);
  view.setUint32(0, width, true);
  view.setUint32(4, height, true);
  new Uint8Array(buffer, 8).fill(7);
  return buffer;
}

describe('parseFrame (B4)', () => {
  it('reads width, height and the RGBA pixels', () => {
    const f = parseFrame(frame(3, 2));
    expect([f.width, f.height, f.rgba.length, f.rgba[0]]).toEqual([3, 2, 24, 7]);
  });

  it('refuses a short or inconsistent buffer', () => {
    expect(() => parseFrame(new ArrayBuffer(4))).toThrow('截圖資料不完整');
    expect(() => parseFrame(frame(3, 2).slice(0, 20))).toThrow('截圖資料不完整');
    expect(() => parseFrame(frame(0, 2))).toThrow('截圖資料不完整');
  });
});

describe('desktop capture hooks (B4)', () => {
  afterEach(uninstallDesktop);

  it('asks the host for the game window and for the shortcut, and listens to the shortcut event', async () => {
    const calls: Array<[string, unknown]> = [];
    const handlers = new Map<string, () => void>();
    let unlistened = 0;
    const apis = {
      invoke: async (command: string, args?: unknown) => {
        calls.push([command, args]);
        return command === 'capture_game_window' ? frame(1, 1) : undefined;
      },
      listen: async (event: string, handler: () => void) => {
        handlers.set(event, handler);
        return () => void unlistened++;
      },
    } as unknown as DesktopApis;
    installDesktop(apis);
    expect(canCaptureGame()).toBe(true);

    const f = await platformHooks().captureGame!();
    expect([f.width, f.height]).toEqual([1, 1]);
    await platformHooks().setCaptureShortcut!('Ctrl+Shift+Space');
    expect(calls).toEqual([
      ['capture_game_window', undefined],
      ['set_capture_shortcut', { accelerator: 'Ctrl+Shift+Space' }],
    ]);

    let pressed = 0;
    const stop = platformHooks().onCaptureShortcut!(() => pressed++);
    await Promise.resolve();
    handlers.get(CAPTURE_SHORTCUT_EVENT)!();
    expect(pressed).toBe(1);
    stop();
    expect(unlistened).toBe(1);
  });

  it('the browser build has no capture', () => {
    expect(canCaptureGame()).toBe(false);
  });
});

describe('compact battle window hooks (B5)', () => {
  afterEach(uninstallDesktop);

  const host = (label: string) => {
    const calls: Array<[string, unknown]> = [];
    const apis = {
      invoke: async (command: string, args?: unknown) => void calls.push([command, args]),
      listen: async () => () => undefined,
      windowLabel: () => label,
    } as unknown as DesktopApis;
    return { apis, calls };
  };

  it('knows when it runs in the compact window, and asks the host to open it or keep it on top', async () => {
    const main = host('main');
    installDesktop(main.apis);
    expect(isCompactWindow()).toBe(false);
    await platformHooks().openBattleWindow!(true);
    await platformHooks().setBattleOnTop!(false);
    expect(main.calls).toEqual([
      ['open_battle_window', { onTop: true }],
      ['set_battle_on_top', { onTop: false }],
    ]);

    const battle = host('battle');
    installDesktop(battle.apis);
    expect(isCompactWindow()).toBe(true);
  });
});
