import { expect, test } from '@playwright/test';
import { deckFingerprint } from '../src/app/core/deck';
import { MALISS, TEST_DECK, importTestDeck, mockCardSource, seedCombos } from './fixtures';

// Card source MOCKED; routes below are abstract test data, not real Maliss combos.
const rows = (r: Array<[number, number]>) => r.map(([cardId, count]) => ({ cardId, count }));
const fingerprint = deckFingerprint({ main: rows(TEST_DECK.main), extra: rows(TEST_DECK.extra) });

function testRoute(id: string, name: string, cardId: number, status: 'verified' | 'unverified', turnOrder: 'first' | 'second' | 'either' = 'either') {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    name,
    archetype: 'E2E',
    format: 'master-duel',
    conditions: { handAllOf: [{ anyOf: [cardId], count: 1 }], setup: { turnOrder, emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: [{ id: 's1', order: 1, actionType: 'other', actorCardIds: [cardId], title: '測試步驟', description: '測試用，不是實際展開' }],
    endBoard: [{ cardId: MALISS.redRansom, zone: 'EMZ', count: 1 }],
    verification: status === 'verified' ? { status, verifiedAt: '2026-10-08', verifiedBy: 'e2e', evidenceNote: 'test data', deckFingerprint: fingerprint } : { status },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  };
}

test.beforeEach(async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '手牌測試');
  await seedCombos(page, [
    testRoute('v1', '已驗證測試路線', MALISS.dormouse, 'verified'),
    testRoute('u1', '未驗證測試路線', MALISS.whiteRabbit, 'unverified'),
    testRoute('f1', '先攻限定測試路線', MALISS.dormouse, 'verified', 'first'),
  ]);
  await page.locator('.deck-row', { hasText: '手牌測試' }).getByRole('link', { name: '起手查詢' }).click();
  await expect(page.getByRole('heading', { name: '起手（0 / 5 張）' })).toBeVisible();
});

test('G4/G6: manual 5-card hand → verified route is 可用, unverified stays 未驗證', async ({ page }) => {
  for (const name of ['Maliss <P> Dormouse', 'Maliss <P> White Rabbit', 'Test Filler 90000001', 'Test Filler 90000002', 'Test Filler 90000003']) {
    await page.getByRole('button', { name: new RegExp(`^加入 ${name.replace(/[<>]/g, '.')}（剩`) }).click();
  }
  await expect(page.getByRole('heading', { name: '起手（5 / 5 張）' })).toBeVisible();
  await expect(page.getByText('可用（已驗證）（2）')).toBeVisible();
  await expect(page.locator('[data-kind="available"]', { hasText: '已驗證測試路線' })).toBeVisible();
  await expect(page.locator('[data-kind="unverified"]', { hasText: '未驗證測試路線' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('無法展開');
});

test('G4: random draw with a typed seed is reproducible; a single-copy card cannot be picked twice', async ({ page }) => {
  await page.getByLabel('種子（選填，可重現）').fill('20261008');
  await page.getByRole('button', { name: '隨機抽 5 張' }).click();
  const first = await page.locator('.hand-slots figure').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(first).toHaveLength(5);
  await page.getByRole('button', { name: '清除' }).click();
  await page.getByRole('button', { name: '隨機抽 5 張' }).click();
  expect(await page.locator('.hand-slots figure').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(first);

  await page.getByRole('button', { name: '清除' }).click();
  const hare = page.getByRole('button', { name: /^加入 Maliss .P. March Hare（剩/ });
  await hare.click();
  await expect(hare).toBeDisabled(); // deck has one copy
});

test('G16: going second needs 6 cards; first-only routes do not count as 可用', async ({ page }) => {
  await page.getByLabel('後攻（6 張）').check();
  await expect(page.getByRole('heading', { name: '起手（0 / 6 張）' })).toBeVisible();
  for (const name of ['Maliss <P> Dormouse', 'Test Filler 90000001', 'Test Filler 90000002', 'Test Filler 90000003', 'Test Filler 90000004']) {
    await page.getByRole('button', { name: new RegExp(`^加入 ${name.replace(/[<>]/g, '.')}（剩`) }).click();
  }
  await expect(page.getByText('尚未選滿（5 / 6 張）')).toBeVisible();
  await page.getByRole('button', { name: /^加入 Test Filler 90000005（剩/ }).click();
  await expect(page.getByText('可用（已驗證）（1）')).toBeVisible();
  await page.getByText(/^不符合（2）/).click();
  await expect(page.getByText('此路線限先攻（5 張起手）')).toBeVisible();

  await page.getByLabel('先攻（5 張）').check();
  await expect(page.getByText('手牌有 6 張，先攻只能 5 張，請移除 1 張')).toBeVisible();
  await expect(page.getByText('選滿 5 張有效手牌後顯示結果。')).toBeVisible();
});
