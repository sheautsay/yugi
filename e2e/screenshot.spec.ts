import { Page, expect, test } from '@playwright/test';
import { MALISS, importTestDeck, mockCardSource, syntheticScreenshot } from './fixtures';

// Card source MOCKED (distinct generated art per card); screenshots are SYNTHETIC compositions.
// These tests prove G14 input handling and the G15a safety rules — not real-screenshot accuracy (G15b).

const NOT_IN_DECK = 77_777_777;
const art = (id: number) => `/ygo-images/cards_cropped/${id}.jpg`;

async function openRecognizer(page: Page) {
  await mockCardSource(page);
  await importTestDeck(page, '截圖測試');
  await page.locator('.deck-row', { hasText: '截圖測試' }).getByRole('link', { name: '起手查詢' }).click();
  await page.getByRole('button', { name: '開啟截圖辨識' }).click();
}

async function uploadShot(page: Page, png: Buffer, name = 'hand.png', mimeType = 'image/png') {
  await page.locator('app-screenshot-recognizer input[type=file]').setInputFiles({ name, mimeType, buffer: png });
}

test('G14/G15a: upload → boxes → recognition → uncertain slot must be chosen → hand applied; screenshot never stored or sent', async ({ page }) => {
  const requests: Array<{ method: string; url: string; body: string | null }> = [];
  page.on('request', (r) => requests.push({ method: r.method(), url: r.url(), body: r.postData() }));
  await openRecognizer(page);

  await expect(page.getByText('牌組主牌中有 18 種卡還沒有辨識用卡圖')).toBeVisible();
  await page.getByRole('button', { name: '下載辨識用卡圖（YGOPRODeck）' }).click();
  await expect(page.getByText('已下載 18 張辨識用卡圖')).toBeVisible({ timeout: 30_000 });

  const hand = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.underground, 90_000_001, NOT_IN_DECK];
  await uploadShot(page, await syntheticScreenshot(page, hand.map(art)));
  await expect(page.getByText('已載入截圖（1280×720）')).toBeVisible();

  await expect(page.getByRole('button', { name: '開始辨識' })).toBeDisabled(); // 0 / 5 boxes
  await page.getByRole('button', { name: '使用預設位置' }).click();
  await expect(page.getByText(/已框選\s*5\s*\/ 5 張/)).toBeVisible();
  await page.getByRole('button', { name: '開始辨識' }).click();

  const slots = page.locator('app-screenshot-recognizer li.slot');
  await expect(slots).toHaveCount(5);
  for (let i = 0; i < 4; i++) await expect(slots.nth(i)).toHaveAttribute('data-status', 'confident');
  await expect(slots.nth(4)).not.toHaveAttribute('data-status', 'confident'); // card not in the deck
  await expect(slots.nth(4).getByText(/不確定|無法辨識/)).toBeVisible();
  await expect(page.getByRole('button', { name: '確認手牌並查詢' })).toBeDisabled();

  await slots.nth(4).getByLabel('從牌組選擇').selectOption({ label: 'Test Filler 90000003（ID 90000003）' });
  await expect(slots.nth(4)).toHaveAttribute('data-status', 'user-selected');
  await page.getByRole('button', { name: '確認手牌並查詢' }).click();

  await expect(page.getByText('已套用截圖辨識結果（由你確認）。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '起手（5 / 5 張）' })).toBeVisible();
  const handLabels = await page.locator('.hand-slots figure').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(handLabels).toEqual([
    'Maliss <P> Dormouse（ID 32061192）',
    'Maliss <P> White Rabbit（ID 69272449）',
    'Maliss in Underground（ID 68337209）',
    'Test Filler 90000001（ID 90000001）',
    'Test Filler 90000003（ID 90000003）',
  ]);
  await expect(page.locator('app-screenshot-recognizer .shot')).toHaveCount(0); // released

  // Privacy: only GETs; nothing with a body; external requests only to the card source.
  expect(requests.filter((r) => r.method !== 'GET' || r.body)).toEqual([]);
  const external = requests.filter((r) => !r.url.startsWith('http://localhost:4310/') || r.url.includes('/ygo-images/'));
  expect(external.every((r) => r.url.includes('/ygo-images/') || r.url.startsWith('https://db.ygoprodeck.com/'))).toBe(true);

  // Nothing but card images (keyed by card ID) is stored as binary data.
  const stored = await page.evaluate(
    () =>
      new Promise<{ imageKeys: string[]; blobsOutsideImages: number }>((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = async () => {
          const db = open.result;
          const all = async (store: string) =>
            new Promise<unknown[]>((res) => {
              const req = db.transaction(store).objectStore(store).getAll();
              req.onsuccess = () => res(req.result);
            });
          const keys = await new Promise<string[]>((res) => {
            const req = db.transaction('images').objectStore('images').getAllKeys();
            req.onsuccess = () => res(req.result as string[]);
          });
          let blobs = 0;
          for (const store of ['decks', 'combos', 'cards', 'layouts', 'meta']) {
            for (const v of await all(store)) if (JSON.stringify(v, (_k, x) => (x instanceof Blob ? (blobs++, 'BLOB') : x)) === undefined) blobs++;
          }
          db.close();
          resolve({ imageKeys: keys, blobsOutsideImages: blobs });
        };
      }),
  );
  expect(stored.imageKeys.every((k) => /^(small|cropped):\d+$/.test(k))).toBe(true);
  expect(stored.blobsOutsideImages).toBe(0);
});

test('G15a: box count must equal the hand size; a saved layout stores boxes only', async ({ page }) => {
  await openRecognizer(page);
  await uploadShot(page, await syntheticScreenshot(page, [MALISS.dormouse, MALISS.whiteRabbit, MALISS.chessyCat, MALISS.mirror, MALISS.gwc06].map(art)));
  await page.getByLabel('逐張框選').check();
  const overlay = page.locator('app-screenshot-recognizer .overlay');
  const box = (await overlay.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.26, box.y + box.height * 0.73);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.34, box.y + box.height * 0.97, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText(/已框選\s*1\s*\/ 5 張/)).toBeVisible();
  await expect(page.getByText('框數必須等於手牌張數才能辨識')).toBeVisible();
  await expect(page.getByRole('button', { name: '開始辨識' })).toBeDisabled();
  await page.getByRole('button', { name: '刪除第 1 框' }).click();
  await expect(page.getByText(/已框選\s*0\s*\/ 5 張/)).toBeVisible();

  await page.getByRole('button', { name: '使用預設位置' }).click();
  await page.getByLabel('版型名稱').fill('1280x720 預設');
  await page.getByRole('button', { name: '儲存框線為版型' }).click();
  await expect(page.getByText('已儲存版型「1280x720 預設」（只存框線位置，不含截圖）。')).toBeVisible();
  const layouts = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = () => {
          const req = open.result.transaction('layouts').objectStore('layouts').getAll();
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );
  expect(layouts).toHaveLength(1);
  expect(Object.keys(layouts[0] as object).sort()).toEqual(['aspectRatio', 'createdAt', 'handSize', 'id', 'name', 'regions', 'schemaVersion']);
});

test('G14: drag-and-drop and Ctrl+V paste both load a screenshot', async ({ page }) => {
  await openRecognizer(page);
  const png = await syntheticScreenshot(page, [MALISS.dormouse, MALISS.whiteRabbit].map(art), { width: 800, height: 450 });
  const b64 = png.toString('base64');

  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'drop.png', { type: 'image/png' }));
    document.querySelector('.drop-zone')!.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(page.getByText('已載入截圖（800×450）')).toBeVisible();
  await page.getByRole('button', { name: '移除截圖' }).click();

  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'paste.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(page.getByText('已載入截圖（800×450）')).toBeVisible();
});

test('N9: wrong type, corrupt image, oversize dimensions and empty clipboard are rejected without touching the hand', async ({ page }) => {
  await openRecognizer(page);
  await page.getByRole('button', { name: /^加入 Maliss .P. Dormouse（剩/ }).click();

  await uploadShot(page, Buffer.from('not an image'), 'notes.txt', 'text/plain');
  await expect(page.getByRole('alert')).toContainText('不是支援的圖片格式');

  await uploadShot(page, Buffer.from('definitely not a png'), 'broken.png', 'image/png');
  await expect(page.getByRole('alert')).toContainText('無法讀取這張圖片');

  const tooWide = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 8200;
    c.height = 10;
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  await uploadShot(page, Buffer.from(tooWide, 'base64'), 'wide.png');
  await expect(page.getByRole('alert')).toContainText('超過上限 8192 px');

  await page.evaluate(() => document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true })));
  await expect(page.getByRole('alert')).toContainText('剪貼簿中沒有圖片');

  await expect(page.getByRole('heading', { name: '起手（1 / 5 張）' })).toBeVisible();
  await expect(page.locator('app-screenshot-recognizer .shot')).toHaveCount(0);
});
