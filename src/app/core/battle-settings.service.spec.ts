import { TestBed } from '@angular/core/testing';
import { BattleSettingsService, DEFAULT_CAPTURE_SHORTCUT, isValidShortcut } from './battle-settings.service';
import { DB_NAME } from './db';

describe('BattleSettingsService (B3)', () => {
  const dbName = `battle-${crypto.randomUUID()}`;
  const make = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: dbName }] });
    return TestBed.inject(BattleSettingsService);
  };

  it('is off by default and lists five routes', async () => {
    const s = make();
    await s.ready;
    expect(s.enabled()).toBe(false);
    expect(s.topN()).toBe(5);
  });

  it('remembers the choice, and only 3, 4 or 5 are accepted for the list length', async () => {
    const first = make();
    await first.ready;
    await first.setEnabled(true);
    await first.setTopN(3);
    const again = make();
    await again.ready;
    expect(again.enabled()).toBe(true);
    expect(again.topN()).toBe(3);
    await again.setTopN(9);
    expect(again.topN()).toBe(5);
  });

  it('B4: keeps a valid capture shortcut and the game-window layouts per hand size', async () => {
    const first = make();
    await first.ready;
    expect(first.shortcut()).toBe(DEFAULT_CAPTURE_SHORTCUT);
    expect(await first.setShortcut('  Alt+F9 ')).toBe(true);
    expect(await first.setShortcut('F9')).toBe(false);
    await first.setGameLayout(5, 'layout-5');
    await first.setGameLayout(6, 'layout-6');
    await first.setGameLayout(6, null);
    const again = make();
    await again.ready;
    expect(again.shortcut()).toBe('Alt+F9');
    expect(again.gameLayouts()).toEqual({ 5: 'layout-5' });
  });

  it('B4: a shortcut needs a modifier and exactly one other key', () => {
    expect(isValidShortcut('Ctrl+Shift+Space')).toBe(true);
    expect(isValidShortcut('CmdOrCtrl+K')).toBe(true);
    expect(isValidShortcut('Space')).toBe(false);
    expect(isValidShortcut('Ctrl+Shift')).toBe(false);
    expect(isValidShortcut('Ctrl+A+B')).toBe(false);
    expect(isValidShortcut('Ctrl++')).toBe(false);
  });

  it('B5: the compact window stays on top unless the user turns it off', async () => {
    const first = make();
    await first.ready;
    expect(first.onTop()).toBe(true);
    await first.setOnTop(false);
    const again = make();
    await again.ready;
    expect(again.onTop()).toBe(false);
  });
});
