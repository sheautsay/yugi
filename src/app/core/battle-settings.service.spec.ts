import { TestBed } from '@angular/core/testing';
import { BattleSettingsService } from './battle-settings.service';
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
});
