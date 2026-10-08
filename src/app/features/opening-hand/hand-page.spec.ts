import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComboRepository } from '../../core/combo-repository';
import { AppDb, DB_NAME } from '../../core/db';
import { deckFingerprint, newDeck } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { drawHand } from '../../core/hand';
import { ComboRoute, DeckRecord } from '../../core/models';
import { HandPage } from './hand-page';
import { HandStateService } from './hand-state.service';

const IDS = Array.from({ length: 14 }, (_, i) => i + 1); // card 14 has a single copy
const DECK: DeckRecord = {
  ...newDeck('測試牌組', '2026-10-08T00:00:00.000Z', 'deck-1'),
  main: IDS.map((cardId) => ({ cardId, count: cardId === 14 ? 1 : 3 })),
};

function route(id: string, cardId: number, status: 'verified' | 'unverified', extra: Partial<ComboRoute> = {}): ComboRoute {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    name: `路線 ${id}`,
    archetype: 'Test',
    format: 'master-duel',
    conditions: { handAllOf: [{ anyOf: [cardId], count: 1 }], setup: { turnOrder: 'either', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: [{ id: 's1', order: 1, actionType: 'other', actorCardIds: [], title: '一步', description: '說明' }],
    endBoard: [],
    verification:
      status === 'verified' ? { status, verifiedAt: '2026-10-08', verifiedBy: 'tester', evidenceNote: 'video', deckFingerprint: deckFingerprint(DECK) } : { status },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    ...extra,
  };
}

async function setup(options: { deck?: DeckRecord; routes?: ComboRoute[]; before?: () => void } = {}) {
  TestBed.configureTestingModule({
    imports: [HandPage],
    providers: [provideRouter([]), { provide: DB_NAME, useValue: `hand-${crypto.randomUUID()}` }],
  });
  options.before?.();
  const db = await TestBed.inject(AppDb).db();
  for (const cardId of [...IDS, 99]) await db.put('cards', { cardId, nameEn: `Card ${cardId}`, kind: 'monster', source: 'test', updatedAt: '' });
  const deck = options.deck ?? DECK;
  await TestBed.inject(DeckRepository).save(deck);
  for (const r of options.routes ?? []) await TestBed.inject(ComboRepository).save(r);
  const fixture = TestBed.createComponent(HandPage);
  fixture.componentRef.setInput('deckId', deck.id);
  // Right after creation only the heading is rendered; wait for the loaded deck content.
  await waitFor(fixture, () => text(fixture).includes('牌組：') || text(fixture).includes('找不到此牌組'));
  return fixture;
}

const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';

async function waitFor(fixture: ComponentFixture<unknown>, done: () => boolean) {
  for (let i = 0; i < 200 && !done(); i++) {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  }
  await fixture.whenStable();
}

function buttons(f: ComponentFixture<unknown>, label: string | RegExp): HTMLButtonElement[] {
  return [...(f.nativeElement as HTMLElement).querySelectorAll('button')].filter((b) => {
    const name = b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '';
    return typeof label === 'string' ? name === label : label.test(name);
  });
}

async function click(f: ComponentFixture<unknown>, label: string | RegExp) {
  const [b] = buttons(f, label);
  if (!b) throw new Error(`no button ${label}`);
  b.click();
  await f.whenStable();
}

async function pick(f: ComponentFixture<unknown>, cardId: number) {
  await click(f, new RegExp(`^加入 Card ${cardId}（`));
}

describe('HandPage — G4 manual selection and random draw', () => {
  it('never lets the hand take more copies than the main deck has (N3)', async () => {
    const f = await setup();
    await pick(f, 14);
    expect(buttons(f, /^加入 Card 14（剩 0 張）/)[0].disabled).toBe(true);
    await pick(f, 14); // no effect
    expect(text(f)).toContain('起手（1 / 5 張）');
  });

  it('shows "not full" and no query until 5 cards, then queries', async () => {
    const f = await setup({ routes: [route('a', 1, 'verified')] });
    for (const id of [1, 1, 2, 3]) await pick(f, id);
    expect(text(f)).toContain('尚未選滿（4 / 5 張）');
    expect(text(f)).not.toContain('可用（已驗證）（');
    await pick(f, 4);
    await waitFor(f, () => text(f).includes('可用（已驗證）（1）'));
    expect(text(f)).toContain('路線 a');
    expect(buttons(f, /^加入/).every((b) => b.disabled)).toBe(true);
  });

  it('random draw with a typed seed is reproducible and never changes the deck', async () => {
    const f = await setup();
    const seedInput = [...(f.nativeElement as HTMLElement).querySelectorAll('label')].find((l) => l.textContent?.includes('種子'))!.querySelector('input')!;
    seedInput.value = '42';
    seedInput.dispatchEvent(new Event('input'));
    await click(f, '隨機抽 5 張');
    const expected = drawHand(DECK.main, 5, 42);
    expect(text(f)).toContain('最近一次隨機抽牌種子：42');
    const shown = [...(f.nativeElement as HTMLElement).querySelectorAll('.hand-slots app-card-tile figure')].map((el) => el.getAttribute('aria-label'));
    expect(shown).toEqual(expected.map((id) => `Card ${id}（ID ${id}）`));
    expect(await TestBed.inject(DeckRepository).get('deck-1')).toEqual(DECK);
  });

  it('clear, remove and undo restore the previous valid hand without touching the deck', async () => {
    const f = await setup();
    for (const id of [1, 2, 3, 4, 5]) await pick(f, id);
    await click(f, '清除');
    expect(text(f)).toContain('起手（0 / 5 張）');
    await click(f, '復原上一手');
    expect(text(f)).toContain('起手（5 / 5 張）');
    await click(f, /^移除第 1 張/);
    expect(text(f)).toContain('起手（4 / 5 張）');
    expect(await TestBed.inject(DeckRepository).get('deck-1')).toEqual(DECK);
  });

  it('a draft deck cannot enter the normal hand mode', async () => {
    const f = await setup({ deck: { ...DECK, id: 'draft', main: DECK.main.slice(0, 3) } });
    expect(text(f)).toContain('此牌組是草稿，不能用於正式查詢');
    expect(buttons(f, /^隨機抽/)).toHaveLength(0);
  });

  it('N3: a stored hand from an older deck version is cleared when no longer valid', async () => {
    const f = await setup({
      before: () => TestBed.inject(HandStateService).set('deck-1', { deckVersion: 0, turnOrder: 'first', hand: [14, 14, 1, 2, 3], history: [], seed: null }),
    });
    expect(text(f)).toContain('原手牌不再符合新牌表，已清除');
    expect(text(f)).toContain('起手（0 / 5 張）');
  });
});

describe('HandPage — G6 result states', () => {
  async function fullHand(f: ComponentFixture<unknown>, ids = [5, 6, 7, 8, 9]) {
    for (const id of ids) await pick(f, id);
    await waitFor(f, () => text(f).includes('符合的固定展開') && !text(f).includes('選滿 5 張有效手牌後'));
  }

  it('with no routes at all: says nothing is recorded yet', async () => {
    const f = await setup();
    await fullHand(f);
    expect(text(f)).toContain('尚未收錄任何 Combo');
    expect(text(f)).not.toContain('無法展開');
  });

  it('with routes that do not fit: "沒有收錄符合…", never "無法展開", reasons available', async () => {
    const f = await setup({ routes: [route('a', 1, 'verified')] });
    await fullHand(f);
    expect(text(f)).toContain('沒有收錄符合目前起手的固定展開');
    expect(text(f)).not.toContain('無法展開');
    expect(text(f)).toContain('不符合（1）');
    expect(text(f)).toContain('起手需要「Card 1」 1 張，目前手牌只有 0 張');
  });

  it('a matching unverified route is listed as 未驗證, never as 可用', async () => {
    const f = await setup({ routes: [route('u', 5, 'unverified')] });
    await fullHand(f);
    expect(text(f)).toContain('未驗證（1）');
    expect(text(f)).toContain('沒有收錄符合目前起手的固定展開');
    expect((f.nativeElement as HTMLElement).querySelector('[data-kind="available"]')).toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('[data-kind="unverified"] .badge')?.textContent).toBe('未驗證');
  });

  it('routes for other decks are counted but not listed', async () => {
    const f = await setup({ routes: [route('other', 99, 'verified'), route('mine', 5, 'verified')] });
    await fullHand(f);
    expect(text(f)).toContain('另有 1 條其他牌組的路線');
    expect(text(f)).toContain('路線 mine');
    expect(text(f)).not.toContain('路線 other');
  });
});

describe('HandPage — G16 six-card hands', () => {
  it('second player needs 6 cards; switching back with 6 cards blocks the query', async () => {
    const f = await setup({ routes: [route('a', 1, 'verified')] });
    for (const id of [1, 2, 3, 4, 5]) await pick(f, id);
    await waitFor(f, () => text(f).includes('可用（已驗證）（1）'));

    const [first, second] = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=radio]')];
    second.click();
    await f.whenStable();
    expect(text(f)).toContain('起手（5 / 6 張）');
    expect(text(f)).toContain('尚未選滿（5 / 6 張）');
    await pick(f, 6);
    await waitFor(f, () => text(f).includes('可用（已驗證）（1）'));
    expect(buttons(f, '隨機抽 6 張')).toHaveLength(1);

    first.click();
    await f.whenStable();
    expect(text(f)).toContain('手牌有 6 張，先攻只能 5 張，請移除 1 張');
    expect(text(f)).toContain('選滿 5 張有效手牌後顯示結果');
    expect(text(f)).toContain('起手（6 / 5 張）');
  });

  it('a first-player-only route is not available when going second', async () => {
    const firstOnly = route('f', 1, 'verified', {
      conditions: { handAllOf: [{ anyOf: [1], count: 1 }], setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    });
    const f = await setup({ routes: [firstOnly] });
    const [, second] = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=radio]')];
    second.click();
    await f.whenStable();
    for (const id of [1, 2, 3, 4, 5, 6]) await pick(f, id);
    await waitFor(f, () => text(f).includes('不符合（1）'));
    expect(text(f)).toContain('此路線限先攻（5 張起手）');
  });
});
