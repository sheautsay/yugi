import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComboRepository } from '../../core/combo-repository';
import { AppDb, DB_NAME } from '../../core/db';
import { deckFingerprint, newDeck } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { ComboRoute } from '../../core/models';
import { ComboEditPage } from './combo-edit-page';

const DORMOUSE = 32061192;
const RANSOM = 68059897;
const DECK = { ...newDeck('實測牌組', '2026-10-08T00:00:00.000Z', 'deck-v'), main: [{ cardId: DORMOUSE, count: 3 }] };

const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';
const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

async function settle(f: ComponentFixture<unknown>, until: () => boolean = () => true) {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await f.whenStable();
    if (until()) return;
  }
}

async function setup(comboId?: string, existing?: ComboRoute) {
  TestBed.configureTestingModule({
    imports: [ComboEditPage],
    providers: [provideRouter([{ path: '**', children: [] }]), { provide: DB_NAME, useValue: `edit-${crypto.randomUUID()}` }],
  });
  const db = await TestBed.inject(AppDb).db();
  for (const [cardId, nameEn] of [
    [DORMOUSE, 'Maliss <P> Dormouse'],
    [RANSOM, 'Maliss <Q> Red Ransom'],
  ] as const) {
    await db.put('cards', { cardId, nameEn, kind: 'monster', source: 'test', updatedAt: '' });
  }
  await TestBed.inject(DeckRepository).save(DECK);
  if (existing) await TestBed.inject(ComboRepository).save(existing);
  const f = TestBed.createComponent(ComboEditPage);
  if (comboId) f.componentRef.setInput('comboId', comboId);
  await settle(f, () => text(f).includes('基本資料'));
  return f;
}

function input(f: ComponentFixture<unknown>, label: string): HTMLInputElement | HTMLTextAreaElement {
  const found = [...el(f).querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(label));
  const control = found?.querySelector('input, textarea');
  if (!control) throw new Error(`no control ${label}`);
  return control as HTMLInputElement;
}

async function type(f: ComponentFixture<unknown>, label: string, value: string) {
  const c = input(f, label);
  c.value = value;
  c.dispatchEvent(new Event('input'));
  await f.whenStable();
}

async function click(f: ComponentFixture<unknown>, name: string, index = 0) {
  const b = [...el(f).querySelectorAll('button')].filter((x) => (x.getAttribute('aria-label') ?? x.textContent?.trim()) === name)[index];
  if (!b) throw new Error(`no button ${name}`);
  b.click();
  await settle(f);
}

/** Search the local card cache inside the n-th open card picker and pick the first result. */
async function pickCard(f: ComponentFixture<unknown>, openButton: string, query: string, action = '加入') {
  await click(f, openButton);
  const search = [...el(f).querySelectorAll('app-card-search')].at(-1)!;
  const q = search.querySelector('input')!;
  q.value = query;
  q.dispatchEvent(new Event('input'));
  (search.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  await settle(f, () => !!search.querySelector('.results button'));
  const pick = [...search.querySelectorAll('.results button')].find((b) => b.textContent?.trim() === action) as HTMLButtonElement;
  pick.click();
  await settle(f);
}

function verifiedRoute(): ComboRoute {
  return {
    schemaVersion: 1,
    id: 'combo-v',
    version: 3,
    name: '已驗證路線',
    archetype: 'Maliss',
    format: 'master-duel',
    conditions: { handAllOf: [{ anyOf: [DORMOUSE], count: 1 }], setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: [{ id: 's1', order: 1, actionType: 'normal-summon', actorCardIds: [DORMOUSE], title: '通常召喚', description: '說明' }],
    endBoard: [{ cardId: RANSOM, zone: 'EMZ', count: 1 }],
    verification: { status: 'verified', verifiedAt: '2026-10-08', verifiedBy: '我', evidenceNote: '錄影', deckFingerprint: deckFingerprint(DECK) },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  };
}

describe('ComboEditPage — G8', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a draft through the UI and blocks saving until required fields are valid', async () => {
    const f = await setup();
    expect(text(f)).toContain('新增 Combo');
    await click(f, '儲存');
    expect(text(f)).toContain('無法儲存，請修正');
    expect(text(f)).toContain('name：必填');

    await type(f, '名稱（必填）', '單卡 Dormouse');
    await pickCard(f, '加入卡片到「第 1 組候選卡」', 'dormouse');
    await click(f, '儲存');
    await settle(f, () => text(f).includes('已儲存（版本 1）'));
    expect(text(f)).toContain('已儲存（版本 1）');
    const [saved] = await TestBed.inject(ComboRepository).list();
    expect(saved).toMatchObject({ name: '單卡 Dormouse', version: 1, verification: { status: 'draft' }, conditions: { handAllOf: [{ anyOf: [DORMOUSE], count: 1 }] } });
  });

  it('steps can be added, edited, moved and deleted (delete asks first); order stays 1..N with stable IDs', async () => {
    const f = await setup();
    await type(f, '名稱（必填）', '步驟測試');
    await pickCard(f, '加入卡片到「第 1 組候選卡」', 'dormouse');
    await click(f, '＋ 新增步驟');
    await click(f, '＋ 新增步驟');
    const field = (li: Element, label: string) => [...li.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!.querySelector('input, textarea') as HTMLInputElement;
    for (const [i, li] of [...el(f).querySelectorAll('li.step')].entries()) {
      for (const [label, value] of [
        ['操作摘要', `步驟${i + 1}`],
        ['完整說明', `說明${i + 1}`],
      ]) {
        const c = field(li, label);
        c.value = value;
        c.dispatchEvent(new Event('input'));
      }
    }
    await f.whenStable();
    const titles = () => [...el(f).querySelectorAll('li.step')].map((li) => field(li, '操作摘要').value);
    expect(titles()).toEqual(['步驟1', '步驟2']);

    await click(f, '下移第 1 步');
    expect(titles()).toEqual(['步驟2', '步驟1']);
    expect([...el(f).querySelectorAll('li.step strong')].map((s) => s.textContent?.trim())).toEqual(['第 1 步', '第 2 步']);

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await click(f, '刪除第 1 步');
    expect(titles()).toEqual(['步驟2', '步驟1']); // cancelled
    await click(f, '刪除第 1 步');
    expect(titles()).toEqual(['步驟1']);

    await click(f, '儲存');
    await settle(f, () => text(f).includes('已儲存'));
    const [saved] = await TestBed.inject(ComboRepository).list();
    expect(saved.steps.map((s) => [s.order, s.title, s.description])).toEqual([[1, '步驟1', '說明1']]);
  });

  it('"verified" cannot be saved without evidence, date, verifier and the tested deck', async () => {
    const f = await setup();
    await type(f, '名稱（必填）', '想直接設已驗證');
    await pickCard(f, '加入卡片到「第 1 組候選卡」', 'dormouse');
    const radio = [...el(f).querySelectorAll<HTMLInputElement>('input[name=status]')][2];
    radio.click();
    await settle(f);
    await click(f, '儲存');
    for (const e of ['步驟不可為空', '非草稿路線需要填寫預計終場', '已驗證需要實測日期', '已驗證需要驗證者', '已驗證需要驗證證據說明', '已驗證需要實測所用牌表的指紋']) {
      expect(text(f)).toContain(e);
    }
    expect(await TestBed.inject(ComboRepository).list()).toEqual([]);
  });

  it('editing a verified route requires updating the evidence or downgrading; saving bumps the version', async () => {
    const f = await setup('combo-v', verifiedRoute());
    expect(text(f)).toContain('編輯 Combo');
    const desc = [...el(f).querySelectorAll('li.step label')].find((l) => l.textContent?.startsWith('完整說明'))!.querySelector('textarea')!;
    desc.value = '改過的說明';
    desc.dispatchEvent(new Event('input'));
    await f.whenStable();
    await click(f, '儲存');
    expect(text(f)).toContain('已驗證路線的條件、步驟或終場已變更');
    expect((await TestBed.inject(ComboRepository).get('combo-v'))?.version).toBe(3);

    [...el(f).querySelectorAll<HTMLInputElement>('input[name=status]')][1].click(); // 未驗證
    await settle(f);
    await click(f, '儲存');
    await settle(f, () => text(f).includes('已儲存（版本 4）'));
    expect(await TestBed.inject(ComboRepository).get('combo-v')).toMatchObject({ version: 4, verification: { status: 'unverified' } });
  });

  it('rejects markup and non-whitelisted source URLs at save time', async () => {
    const f = await setup('combo-v', { ...verifiedRoute(), verification: { status: 'unverified' } });
    await type(f, '來源網址（https，限白名單網站）', 'javascript:alert(1)');
    await type(f, '說明', '<script>alert(1)</script>');
    await click(f, '儲存');
    expect(text(f)).toContain('source.url：');
    expect(text(f)).toContain('description：不可包含 HTML 標籤');
    expect((await TestBed.inject(ComboRepository).get('combo-v'))?.description).toBeUndefined();
  });

  it('deleting the combo asks for confirmation', async () => {
    const f = await setup('combo-v', verifiedRoute());
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await click(f, '刪除此 Combo');
    expect(spy).toHaveBeenCalled();
    expect(await TestBed.inject(ComboRepository).get('combo-v')).toBeTruthy();
    spy.mockReturnValue(true);
    await click(f, '刪除此 Combo');
    await settle(f);
    expect(await TestBed.inject(ComboRepository).get('combo-v')).toBeUndefined();
  });
});
