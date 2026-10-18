import { expect, test } from '@playwright/test';
import { dumpUserData, importTestDeck, mockCardSource } from './fixtures';

// Stored times are UTC; the page must show Taiwan time (UTC+8). The browser is pinned to
// Asia/Taipei so the expectation does not depend on the test machine.
test.use({ timezoneId: 'Asia/Taipei' });

test('analysis history and run details show local (Taiwan) time', async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '時間測試');
  const deck = (await dumpUserData(page)).decks[0] as { id: string; version: number };
  const run = {
    id: 'run-time-test',
    deckId: deck.id,
    deckName: '時間測試',
    deckVersion: deck.version,
    deckFingerprint: 'fp1-00000000000000',
    cardDataVersion: 'test',
    assumptions: ['先攻'],
    provider: 'chatgpt',
    model: 'gpt-mock',
    params: { timeoutSeconds: 900, store: false, stream: true, structuredOutput: true },
    scope: { single: true, multi: true, extenders: true, maxRoutes: 5 },
    promptVersion: 'deck-analysis-v1',
    cacheKey: 'ai1-00000000000000',
    startedAt: '2026-10-09T02:17:23.000Z',
    finishedAt: '2026-10-09T02:19:05.000Z',
    durationMs: 102000,
    status: 'failed',
    error: { code: 'network', message: '測試用紀錄' },
  };
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = () => {
          const tx = open.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: `aiRun:${value.id}`, value });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    run,
  );

  await page.goto(`/decks/${deck.id}/analysis`);
  await expect(page.getByRole('button', { name: '2026-10-09 10:17:23' })).toBeVisible();
  await page.getByText('分析紀錄（牌組、資料版本、規則假設、模型與參數）').click();
  await expect(page.getByText('2026-10-09 10:17:23 → 2026-10-09 10:19:05（102.0 秒）')).toBeVisible();
  await expect(page.getByText('2026-10-09T02:17:23')).toHaveCount(0);
});
