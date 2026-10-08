import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FETCH_FN, SLEEP_FN } from '../../core/card-api';
import { AppDb, DB_NAME } from '../../core/db';
import { checkDeck, newDeck, ParsedDeck } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord } from '../../core/models';
import { toYdke } from '../../core/ydke';
import { DeckImportPanel } from './deck-import-panel';

const MAIN_IDS = Array.from({ length: 14 }, (_, i) => 10_000_000 + i);
const EXTRA_IDS = Array.from({ length: 5 }, (_, i) => 20_000_000 + i);

/** 40 main (13×3 + 1) / 15 extra (5×3) / 0 side. */
const deck40: ParsedDeck = {
  main: MAIN_IDS.map((cardId, i) => ({ cardId, count: i < 13 ? 3 : 1 })),
  extra: EXTRA_IDS.map((cardId) => ({ cardId, count: 3 })),
  side: [],
};

function record(cardId: number, extra = false): CardRecord {
  return { cardId, nameEn: `Card ${cardId}`, kind: 'monster', isExtraDeckType: extra, source: 'test', updatedAt: '2026-10-08T00:00:00.000Z' };
}

async function setup(options: { seedCards?: boolean; fetch?: (url: string) => Promise<Response> } = {}) {
  TestBed.configureTestingModule({
    imports: [DeckImportPanel],
    providers: [
      { provide: DB_NAME, useValue: `import-${crypto.randomUUID()}` },
      { provide: SLEEP_FN, useValue: async () => undefined },
      { provide: FETCH_FN, useValue: options.fetch ?? (async () => Promise.reject(new TypeError('offline'))) },
    ],
  });
  const db = await TestBed.inject(AppDb).db();
  if (options.seedCards !== false) {
    for (const id of MAIN_IDS) await db.put('cards', record(id));
    for (const id of EXTRA_IDS) await db.put('cards', record(id, true));
  }
  const repo = TestBed.inject(DeckRepository);
  const fixture = TestBed.createComponent(DeckImportPanel);
  await fixture.whenStable();
  return { fixture, repo, el: fixture.nativeElement as HTMLElement };
}

async function paste(fixture: ComponentFixture<DeckImportPanel>, text: string) {
  const el = fixture.nativeElement as HTMLElement;
  const textarea = el.querySelector('textarea')!;
  textarea.value = text;
  textarea.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  button(el, '解析').click();
  await settle(fixture);
}

function button(el: HTMLElement, label: string): HTMLButtonElement {
  const found = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`button ${label} not found`);
  return found;
}

function setInput(fixture: ComponentFixture<DeckImportPanel>, label: string, value: string) {
  const input = [...(fixture.nativeElement as HTMLElement).querySelectorAll('label')].find((l) => l.textContent?.includes(label))!.querySelector('input')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  }
}

/** Polls until the async IndexedDB work behind a click has rendered. */
async function waitForText(fixture: ComponentFixture<unknown>, text: string) {
  const el = fixture.nativeElement as HTMLElement;
  for (let i = 0; i < 200 && !el.textContent?.includes(text); i++) await settle(fixture);
}

describe('DeckImportPanel — G3 / G13 UI', () => {
  afterEach(() => vi.restoreAllMocks());

  it('previews zone totals and writes nothing until the user confirms', async () => {
    const { fixture, repo, el } = await setup();
    await paste(fixture, toYdke(deck40));

    expect(el.textContent).toContain('預覽（尚未寫入）— 格式：ydke://');
    expect(el.textContent).toMatch(/主牌 40 張／額外 15 張／備牌 0 張/);
    expect(el.textContent).toContain('牌表檢核通過');
    expect(await repo.list()).toEqual([]);

    setInput(fixture, '新牌組名稱', '測試牌組');
    await fixture.whenStable();
    button(el, '確認匯入').click();
    await settle(fixture);

    const [saved] = await repo.list();
    expect(saved).toMatchObject({ name: '測試牌組', main: deck40.main, extra: deck40.extra, side: [], source: { type: 'ydke' }, version: 1 });
    expect(saved.importWarnings).toBeUndefined();
  });

  it('cancel leaves existing decks untouched (N6)', async () => {
    const { fixture, repo, el } = await setup();
    const existing = { ...newDeck('原有牌組', '2026-10-01T00:00:00.000Z', 'keep'), main: [{ cardId: 1, count: 1 }] };
    await repo.save(existing);
    fixture.componentRef.setInput('decks', [existing]);
    await paste(fixture, toYdke(deck40));
    button(el, '取消').click();
    await settle(fixture);
    expect(el.textContent).not.toContain('預覽');
    expect(await repo.list()).toEqual([existing]);
  });

  it('invalid YDK shows line-numbered errors, no preview and no way to confirm', async () => {
    const { fixture, repo, el } = await setup();
    await paste(fixture, '#main\n10000000\nabc\n-5\n');
    expect(el.textContent).toContain('無法匯入');
    expect(el.textContent).toContain('第 3 行「abc」');
    expect(el.textContent).toContain('第 4 行「-5」');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.includes('確認匯入'))).toBe(false);
    expect(await repo.list()).toEqual([]);
  });

  it('an in-game style code is not guessed: research notice, no deck', async () => {
    const { fixture, repo, el } = await setup();
    await paste(fixture, 'MDXK-7F3Q-9ZPA');
    expect(el.textContent).toContain('研究中');
    expect(await repo.list()).toEqual([]);
  });

  it('unknown card IDs are listed, the import can only become a non-queryable draft', async () => {
    const { fixture, repo, el } = await setup({ seedCards: false });
    await paste(fixture, toYdke(deck40));
    expect(el.textContent).toContain('匯入後會是草稿');
    expect(el.textContent).toContain('19 種卡片尚未識別');

    button(el, '從 YGOPRODeck 下載缺少的卡片資料').click();
    await waitForText(fixture, '已快取的資料不受影響');
    expect(el.textContent).toContain('已快取的資料不受影響'); // fetch is offline in this test

    setInput(fixture, '新牌組名稱', '草稿牌組');
    await fixture.whenStable();
    button(el, '確認匯入').click();
    await settle(fixture);
    const [saved] = await repo.list();
    expect(saved.importWarnings?.join()).toContain('尚未識別');
    expect(checkDeck(saved, new Map()).queryable).toBe(false);
  });

  it('downloading resolves unknown IDs (mocked source) and marks the rest as unknown', async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ data: MAIN_IDS.slice(0, 13).map((id) => ({ id, name: `Card ${id}`, type: 'Effect Monster', frameType: 'effect' })) }), { status: 200 });
    const { fixture, el } = await setup({ seedCards: false, fetch });
    await paste(fixture, toYdke(deck40));
    button(el, '從 YGOPRODeck 下載缺少的卡片資料').click();
    await waitForText(fixture, '查無');
    expect(el.textContent).toContain('查無 6 個 ID');
    expect(el.textContent).toContain('6 種卡片尚未識別');
  });

  it('replacing an existing deck asks for confirmation and bumps its version', async () => {
    const { fixture, repo, el } = await setup();
    const existing = newDeck('舊版', '2026-10-01T00:00:00.000Z', 'deck-a');
    await repo.save(existing);
    fixture.componentRef.setInput('decks', [existing]);
    await paste(fixture, toYdke(deck40));
    const select = el.querySelector('select')!;
    select.value = 'deck-a';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    button(el, '確認匯入').click();
    await settle(fixture);
    expect((await repo.get('deck-a'))?.main).toEqual([]);

    confirmSpy.mockReturnValue(true);
    button(el, '確認匯入').click();
    await settle(fixture);
    expect(await repo.get('deck-a')).toMatchObject({ name: '舊版', version: 2, main: deck40.main, createdAt: existing.createdAt });
  });
});
