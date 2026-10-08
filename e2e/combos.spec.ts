import { Page, expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { MALISS, dumpUserData, importTestDeck, mockCardSource, testComboRoute } from './fixtures';

// Card source MOCKED; routes are test data (see fixtures.ts), not real verified combos.

async function pasteImport(page: Page, json: string) {
  await page.goto('/combos');
  await page.getByLabel('JSON 內容').fill(json);
  await page.getByRole('button', { name: '檢查' }).click();
}

test.beforeEach(async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '路線測試牌組'); // also caches the card data the routes reference
});

test('G8: import previews first, never keeps "verified", then export round-trips the stored routes', async ({ page }) => {
  const routes = [testComboRoute({ id: 'r-verified', name: '標示已驗證', status: 'verified' }), testComboRoute({ id: 'r-plain', name: '一般路線' })];
  await pasteImport(page, JSON.stringify({ format: 'ygo-combo-assistant/combos', combos: routes }));

  await expect(page.getByText('預覽（尚未寫入）：2 條')).toBeVisible();
  await expect(page.getByText('原檔標示為已驗證，匯入後改為「未驗證」，需在本機重新實測確認')).toBeVisible();
  expect((await dumpUserData(page)).combos).toEqual([]);

  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.getByRole('status')).toContainText('已匯入 2 條 Combo');
  const rows = page.locator('.combo-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: '標示已驗證' }).getByText('未驗證', { exact: true })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出全部（JSON）' }).click()]);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.format).toBe('ygo-combo-assistant/combos');
  expect(exported.combos).toEqual((await dumpUserData(page)).combos.sort((a, b) => ((a as { name: string }).name < (b as { name: string }).name ? -1 : 1)));
});

test('N5/N6: invalid or malicious files are rejected as a whole and nothing is written', async ({ page }) => {
  const good = testComboRoute({ id: 'good' });
  const cases: Array<[unknown, string]> = [
    [{ ...testComboRoute({ id: 'x1' }), steps: [] }, '步驟不可為空'],
    [{ ...good, id: 'x2', steps: [good.steps[0], { ...good.steps[1], id: good.steps[0].id }, good.steps[2]] }, '步驟 ID 重複'],
    [{ ...good, id: 'x3', name: '' }, 'name：必填'],
    [{ ...good, id: 'x4', endBoard: [{ cardId: 12345678, zone: 'EMZ', count: 1 }] }, '引用未知卡片'],
    [{ ...good, id: 'x5', source: { url: 'javascript:alert(1)' } }, 'source.url'],
    [{ ...good, id: 'x6', script: 'fetch("https://evil.example")' }, 'script'],
    [{ ...good, id: 'x7', description: '<img src=x onerror=alert(1)>' }, '不可包含 HTML 標籤'],
  ];
  for (const [bad, expected] of cases) {
    await pasteImport(page, JSON.stringify([good, bad]));
    await expect(page.getByRole('alert')).toContainText('無法匯入（未寫入任何資料）');
    await expect(page.getByRole('alert')).toContainText(expected);
  }
  await pasteImport(page, '{"not json"');
  await expect(page.getByRole('alert')).toContainText('不是有效的 JSON');
  expect((await dumpUserData(page)).combos).toEqual([]);
});

test('G8: ID conflicts can keep both, overwrite or skip; delete needs confirmation', async ({ page }) => {
  const route = testComboRoute({ id: 'same-id', name: '衝突路線' });
  await pasteImport(page, JSON.stringify(route));
  await page.getByRole('button', { name: '確認匯入' }).click();

  await pasteImport(page, JSON.stringify({ ...route, name: '衝突路線 v2' }));
  await expect(page.getByText('ID 已存在')).toBeVisible();
  await page.getByLabel(/條與現有 Combo 的 ID 相同時/).selectOption('keep-both');
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(2);
  await expect(page.getByText('衝突路線 v2（匯入）')).toBeVisible();

  await pasteImport(page, JSON.stringify({ ...route, name: '衝突路線 v3' }));
  await page.getByLabel(/條與現有 Combo 的 ID 相同時/).selectOption('overwrite');
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(2);
  await expect(page.getByText('衝突路線 v3', { exact: true })).toBeVisible();

  const row = page.locator('.combo-row', { hasText: '衝突路線 v3' });
  page.once('dialog', (d) => d.dismiss());
  await row.getByRole('button', { name: '刪除' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(2);
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: '刪除' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(1);
});

test('G8: a route created in the editor is saved, copied as a draft and keeps its version history', async ({ page }) => {
  await page.goto('/combos/new');
  await page.getByLabel('名稱（必填）').fill('編輯器建立的路線');
  await page.getByRole('button', { name: '加入卡片到「第 1 組候選卡」' }).click();
  await page.getByLabel(/搜尋要加入「第 1 組候選卡」的卡/).fill('dormouse');
  await page.getByRole('button', { name: '搜尋', exact: true }).click();
  await page.getByRole('button', { name: '加入', exact: true }).first().click();
  await page.getByRole('button', { name: '＋ 新增步驟' }).click();
  await page.getByLabel('操作摘要（必填）').fill('通常召喚');
  await page.getByLabel('完整說明（必填）').fill('從手牌通常召喚（測試資料）。');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('status')).toContainText('已儲存（版本 1）');
  await expect(page).toHaveURL(/\/combos\/[\w-]+\/edit$/);

  await page.getByLabel('說明', { exact: true }).fill('第二版');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('status')).toContainText('已儲存（版本 2）');

  await page.goto('/combos');
  await page.locator('.combo-row', { hasText: '編輯器建立的路線' }).getByRole('button', { name: '複製' }).click();
  await expect(page.locator('.combo-row', { hasText: '編輯器建立的路線（複本）' }).getByText('草稿')).toBeVisible();
  const stored = (await dumpUserData(page)).combos as Array<{ name: string; version: number; conditions: { handAllOf: Array<{ anyOf: number[] }> } }>;
  expect(stored.find((c) => c.name === '編輯器建立的路線')).toMatchObject({ version: 2, conditions: { handAllOf: [{ anyOf: [MALISS.dormouse] }] } });
});
