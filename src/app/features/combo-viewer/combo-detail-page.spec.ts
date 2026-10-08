import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComboRepository } from '../../core/combo-repository';
import { DB_NAME } from '../../core/db';
import { ComboRoute, ComboStep } from '../../core/models';
import { ComboDetailPage } from './combo-detail-page';

function route(id: string, steps: number, extra: Partial<ComboRoute> = {}): ComboRoute {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    name: `路線 ${id}`,
    archetype: 'Test',
    format: 'master-duel',
    conditions: { handAllOf: [{ anyOf: [1], count: 1 }], setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: Array.from(
      { length: steps },
      (_, i): ComboStep => ({
        id: `${id}-s${i + 1}`,
        order: i + 1,
        actionType: 'activate',
        actorCardIds: [1],
        title: `${id} 步驟 ${i + 1}`,
        description: `說明 ${i + 1}`,
        ...(i === 1 ? { warning: '此效果每回合只能使用 1 次', costText: '除外 1 張' } : {}),
      }),
    ),
    endBoard: [{ cardId: 2, zone: 'EMZ', count: 1 }],
    verification: { status: 'unverified' },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    ...extra,
  };
}

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const text = (f: ComponentFixture<unknown>) => el(f).textContent ?? '';

async function settle(f: ComponentFixture<unknown>, until: () => boolean = () => true) {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await f.whenStable();
    if (until()) return;
  }
}

async function setup(routes: ComboRoute[], open = routes[0].id) {
  TestBed.configureTestingModule({ imports: [ComboDetailPage], providers: [provideRouter([]), { provide: DB_NAME, useValue: `view-${crypto.randomUUID()}` }] });
  for (const r of routes) await TestBed.inject(ComboRepository).save(r);
  const f = TestBed.createComponent(ComboDetailPage);
  f.componentRef.setInput('comboId', open);
  await settle(f, () => text(f).includes('觀看模式') || text(f).includes('找不到 Combo') || text(f).includes('圖像流程'));
  return f;
}

async function click(f: ComponentFixture<unknown>, name: string) {
  const b = [...el(f).querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? x.textContent?.trim()) === name);
  if (!b) throw new Error(`no button ${name}`);
  b.click();
  await settle(f);
}

const progress = (f: ComponentFixture<unknown>) => el(f).querySelector('.progress')?.textContent?.trim();
const currentNode = (f: ComponentFixture<unknown>) => el(f).querySelector('.node.current')?.getAttribute('data-order');

async function key(f: ComponentFixture<unknown>, k: string, target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  await settle(f);
}

describe('ComboDetailPage — G7 shared currentStep', () => {
  it('A → B keeps the step picked in the flow, and B → A keeps the step reached in B', async () => {
    const f = await setup([route('r', 16)]);
    expect(currentNode(f)).toBe('1');
    await click(f, '第 7 步：r 步驟 7');
    expect(currentNode(f)).toBe('7');
    await click(f, '逐步教學');
    expect(progress(f)).toBe('第 7 / 16 步');
    expect(text(f)).toContain('r 步驟 7');
    await click(f, '下一步');
    await click(f, '下一步');
    expect(progress(f)).toBe('第 9 / 16 步');
    await click(f, '圖像流程');
    expect(currentNode(f)).toBe('9');
  });

  it('N8: never goes past 1..N with buttons, select or keys; jump-to-end lands on N', async () => {
    const f = await setup([route('r', 3)]);
    await click(f, '逐步教學');
    const prev = () => [...el(f).querySelectorAll('button')].find((b) => b.textContent?.trim() === '上一步')!;
    const next = () => [...el(f).querySelectorAll('button')].find((b) => b.textContent?.trim() === '下一步')!;
    expect(prev().disabled).toBe(true);
    await key(f, 'ArrowLeft');
    expect(progress(f)).toBe('第 1 / 3 步');
    await click(f, '跳至終場');
    expect(progress(f)).toBe('第 3 / 3 步');
    expect(next().disabled).toBe(true);
    next().click();
    await key(f, 'ArrowRight');
    expect(progress(f)).toBe('第 3 / 3 步');
    const select = el(f).querySelector<HTMLSelectElement>('.nav select')!;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await settle(f);
    expect(progress(f)).toBe('第 2 / 3 步');
  });

  it('arrow keys move steps in mode B but not while typing in a form field', async () => {
    const f = await setup([route('r', 5)]);
    await click(f, '逐步教學');
    await key(f, 'ArrowRight');
    expect(progress(f)).toBe('第 2 / 5 步');
    const field = document.createElement('input');
    document.body.appendChild(field);
    await key(f, 'ArrowRight', field);
    expect(progress(f)).toBe('第 2 / 5 步');
    field.remove();
    await key(f, 'ArrowLeft');
    expect(progress(f)).toBe('第 1 / 5 步');
  });

  it('switching to another route starts again at step 1', async () => {
    const f = await setup([route('a', 10), route('b', 4)]);
    await click(f, '逐步教學');
    await click(f, '跳至終場');
    expect(progress(f)).toBe('第 10 / 10 步');
    f.componentRef.setInput('comboId', 'b');
    await settle(f, () => text(f).includes('路線 b'));
    expect(progress(f)).toBe('第 1 / 4 步');
  });

  it('a route without steps shows pending content and no navigation', async () => {
    const f = await setup([route('empty', 0, { verification: { status: 'draft' } })]);
    expect(text(f)).toContain('此路線尚未填寫步驟（待補內容）');
    expect([...el(f).querySelectorAll('button')].some((b) => b.textContent?.trim() === '下一步')).toBe(false);
  });

  it('missing fields read 未填; concise mode still shows the warning', async () => {
    const f = await setup([route('r', 3)]);
    await click(f, '逐步教學');
    await click(f, '下一步');
    expect(text(f)).toContain('⚠ 注意事項：此效果每回合只能使用 1 次');
    expect(text(f)).toContain('代價除外 1 張');
    expect(text(f)).toContain('目標未填');
    const detailed = el(f).querySelector<HTMLInputElement>('.nav input[type=checkbox]')!;
    detailed.click();
    await settle(f);
    expect(text(f)).not.toContain('代價除外 1 張');
    expect(text(f)).toContain('⚠ 注意事項：此效果每回合只能使用 1 次');
  });

  it('mode B has a "返回列表" link back to where the route was opened from', async () => {
    const f = await setup([route('r', 2)]);
    await click(f, '逐步教學');
    const back = () => [...el(f).querySelectorAll('a')].find((a) => a.textContent?.trim() === '返回列表')!;
    expect(back().getAttribute('href')).toBe('/combos');
    f.componentRef.setInput('deck', 'deck-9');
    await settle(f);
    expect(back().getAttribute('href')).toBe('/decks/deck-9/hand');
  });

  it('unverified routes are labelled as reference only; the flow shows the end board', async () => {
    const f = await setup([route('r', 2)]);
    expect(text(f)).toContain('此路線未驗證，尚未經人工實測，僅供參考。');
    expect(el(f).querySelector('.end-node')?.textContent).toContain('終場');
  });
});
