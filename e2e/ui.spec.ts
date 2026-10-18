import { Browser, Page, expect, test } from '@playwright/test';
import { TOKENS, importTestDeck, mockCardSource, seedCombos, testComboRoute, toYdke } from './fixtures';

// CR-012 UI/UX acceptance (docs/acceptance-ui-v1.md) on the browser build, card source MOCKED. The same design checks run
// against the installed Windows app in e2e-desktop/5-ui.spec.ts (production build inside WebView2).

const DECK = 'UI 驗收牌組';
const ROUTE = testComboRoute({ id: 'ui-route', name: 'UI 驗收路線', status: 'verified', steps: 4 });


async function seed(page: Page): Promise<string> {
  await mockCardSource(page);
  await importTestDeck(page, DECK);
  await seedCombos(page, [ROUTE]);
  await page.goto('/decks');
  const href = await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: '編輯' }).getAttribute('href');
  return href!.split('/').pop()!;
}

const pages = (deckId: string) => [
  { path: '/home', h1: '首頁' },
  { path: '/decks', h1: '牌組' },
  { path: `/decks/${deckId}`, h1: '編輯牌組' },
  { path: `/decks/${deckId}/hand`, h1: '起手與 Combo 查詢' },
  { path: `/decks/${deckId}/analysis`, h1: `AI 展開分析：${DECK}` },
  { path: '/combos', h1: 'Combo 管理' },
  { path: '/combos/new', h1: '新增 Combo' },
  { path: '/combos/ui-route', h1: 'UI 驗收路線' },
  { path: '/combos/ui-route/edit', h1: '編輯 Combo' },
  { path: '/settings', h1: '設定' },
  { path: '/no-such-page', h1: '找不到頁面' },
];

async function designCheck(page: Page, where: string) {
  const r = await page.evaluate(() => {
    const css = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const defaultBlue = ['rgb(0, 0, 238)', 'rgb(85, 26, 139)'];
    const links = [...document.querySelectorAll('a')].filter((a) => (a as HTMLElement).offsetParent !== null);
    const badLinks = links.filter((a) => defaultBlue.includes(getComputedStyle(a).color)).map((a) => a.textContent?.trim());
    const underlinedNav = [...document.querySelectorAll('nav a, a.button, .page-links a')]
      .filter((a) => (a as HTMLElement).offsetParent !== null && getComputedStyle(a).textDecorationLine.includes('underline'))
      .map((a) => a.textContent?.trim());
    const primary = document.querySelector('button.primary, a.button.primary');
    return {
      bodyBg: css(document.body)!.backgroundColor,
      bodyColor: css(document.body)!.color,
      font: css(document.body)!.fontFamily,
      primaryBg: primary ? css(primary)!.backgroundColor : null,
      badLinks,
      underlinedNav,
    };
  });
  expect(r.badLinks, `${where}: links with the browser default colour`).toEqual([]);
  expect(r.underlinedNav, `${where}: navigation/button links underlined`).toEqual([]);
  expect(r.bodyBg, where).toBe(TOKENS.bg);
  expect(r.bodyColor, where).toBe(TOKENS.text);
  expect(r.font, where).toContain('Segoe UI');
  if (r.primaryBg) expect(r.primaryBg, `${where}: primary button`).toBe(TOKENS.primary);
}

test('UI1 / UI4 / UI5: every main route opens with its title, the shared design and no browser-default links; no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|chatgpt-bridge/.test(m.text()) && errors.push(m.text()));
  const deckId = await seed(page);
  for (const p of pages(deckId)) {
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(p.h1);
    await expect(page.getByRole('navigation', { name: '主要導覽' })).toBeVisible();
    await designCheck(page, p.path);
  }
  expect(errors).toEqual([]);
});

test('UI3-style shell: the current page is marked in the navigation and the shortcuts open the current deck', async ({ page }) => {
  const deckId = await seed(page);
  await page.goto('/decks');
  const nav = page.getByRole('navigation', { name: '主要導覽' });
  await expect(nav.getByRole('link', { name: '牌組', exact: true })).toHaveAttribute('aria-current', 'page');
  // With one deck it is already the current one; add a second (newest) deck, then choose the first explicitly.
  await page.getByLabel('牌組名稱', { exact: true }).fill('第二副牌組');
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.locator('.deck-row', { hasText: '第二副牌組' }).getByText('目前使用')).toBeVisible();
  await page.locator('.deck-row', { hasText: DECK }).getByRole('button', { name: '使用此牌組' }).click();
  await expect(page.locator('.deck-row', { hasText: DECK }).getByText('目前使用')).toBeVisible();
  await nav.getByRole('link', { name: /起手查詢/ }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}/hand$`));
  await expect(nav.getByRole('link', { name: /起手查詢/ })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: /AI 展開分析/ }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}/analysis$`));
  await page.getByRole('button', { name: '返回上一個畫面' }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}/hand$`));
});

test('UI9: advanced AI settings are folded by default and open on request; the common settings stay in front', async ({ page }) => {
  const deckId = await seed(page);
  await page.goto(`/decks/${deckId}/analysis`);
  await expect(page.getByLabel('單卡展開')).toBeVisible();
  await expect(page.getByLabel('雙卡展開')).toBeVisible();
  await expect(page.getByLabel('三卡展開')).toBeVisible();
  await expect(page.getByRole('group', { name: /分析目標/ })).toBeVisible();
  await expect(page.getByLabel('最多顯示路線數')).toBeHidden();
  await page.getByText('進階設定').click();
  await expect(page.getByLabel('最多顯示路線數')).toBeVisible();
  // No made-up percentage anywhere on the page.
  expect(await page.locator('main').innerText()).not.toMatch(/\d+\s*%(?!\))/);
});

test('UI6: the import area separates the methods and labels the Master Duel code as an assisted flow', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/decks');
  await expect(page.getByRole('heading', { name: '貼上牌表' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /用 Master Duel 牌組代碼匯入/ })).toContainText('需開啟官方網頁');
  await expect(page.getByRole('heading', { name: '建立空白牌組' })).toBeVisible();
  await expect(page.getByRole('list', { name: '匯入步驟' }).getByRole('listitem')).toHaveText(['輸入', '解析', '檢視牌組', '確認匯入']);
  await expect(page.getByText(/一鍵|自動匯入/)).toHaveCount(0);
});

const SIZES = [
  { width: 1280, height: 720, scale: 1 },
  { width: 1366, height: 768, scale: 1 },
  { width: 1920, height: 1080, scale: 1 },
  { width: 1280, height: 720, scale: 1.25 },
  { width: 1280, height: 720, scale: 1.5 },
];

async function layoutCheck(page: Page, where: string) {
  const r = await page.evaluate(() => {
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const clipped = [...document.querySelectorAll('button, a.button')]
      .filter(visible)
      .filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1)
      .map((el) => el.textContent?.trim());
    const side = document.querySelector('.sidebar')!.getBoundingClientRect();
    const main = document.querySelector('main')!.getBoundingClientRect();
    return { scroll: document.documentElement.scrollWidth, inner: innerWidth, clipped, overlap: main.left < side.right - 1 && side.width < innerWidth };
  });
  expect(r.scroll, `${where}: horizontal page scroll`).toBeLessThanOrEqual(r.inner);
  expect(r.clipped, `${where}: buttons with clipped text`).toEqual([]);
  expect(r.overlap, `${where}: content under the navigation`).toBe(false);
}

test('UI13: 1280×720, 1366×768, 1920×1080 and 125% / 150% scaling — no horizontal scroll, no clipped buttons, no overlap', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  for (const s of SIZES) {
    const context = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale });
    const page = await context.newPage();
    const deckId = await seed(page);
    for (const p of pages(deckId)) {
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await layoutCheck(page, `${p.path} @ ${s.width}x${s.height}x${s.scale}`);
    }
    await context.close();
  }
});

test('UI14: keyboard — Tab reaches the skip link, the navigation and the main actions with a visible focus ring; Escape closes a dialog; reduced motion is respected', async ({ page }) => {
  await seed(page);
  await page.goto('/decks');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要內容' })).toBeFocused();
  const ring = async () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
  expect((await ring()).style).not.toBe('none');
  // Into the navigation.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="主要導覽"]'))) break;
  }
  expect(await page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="主要導覽"]'))).toBe(true);
  const r = await ring();
  expect(r.style).not.toBe('none');
  expect(r.width).toBeGreaterThanOrEqual(2);
  // Enter follows the focused link.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Escape closes the card details dialog (search covers the synced pool, so sync the mocked full card list first).
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/).first()).toBeVisible();
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: '編輯' }).click();
  await page.getByLabel('卡名（英文／繁中／俗稱）或卡片 ID').fill('Maliss');
  const detailButton = page.getByRole('button', { name: /查看 .+ 詳細資訊/ }).first();
  await detailButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // Reduced motion.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('button')!).transitionDuration));
  expect(duration).toBeLessThan(0.01);
});

test('UI18: contrast — main text ≥ 4.5:1, secondary text ≥ 3:1; body text at least 14 px', async ({ page }) => {
  await seed(page);
  await page.goto('/decks');
  await expect(page.locator('.deck-row').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const card = document.querySelector('.deck-card, .card')!;
    const cardBg = getComputedStyle(card).backgroundColor;
    const muted = getComputedStyle(document.querySelector('.muted')!).color;
    const sizes = [...document.querySelectorAll('main p, main li, main label, main button')].map((e) => parseFloat(getComputedStyle(e).fontSize));
    return {
      main: ratio(getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor),
      onCard: ratio(getComputedStyle(document.body).color, cardBg),
      muted: ratio(muted, cardBg),
      minFont: Math.min(...sizes),
    };
  });
  expect(r.main).toBeGreaterThanOrEqual(4.5);
  expect(r.onCard).toBeGreaterThanOrEqual(4.5);
  expect(r.muted).toBeGreaterThanOrEqual(3);
  expect(r.minFont).toBeGreaterThanOrEqual(13); // the smallest helper text (0.8125rem = 13px); body text is 15px
});

test('UI13: a long draft reason on the home page wraps instead of widening the page (found on Windows 10 at 1024 px)', async ({ page }) => {
  await mockCardSource(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/decks');
  // 41 cards the local card data does not know: the draft reason lists their IDs.
  const ids = Array.from({ length: 41 }, (_, i) => 90_100_001 + i);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke({ main: ids.map((id): [number, number] => [id, 1]), extra: [], side: [] }));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByLabel('新牌組名稱').fill('長原因草稿');
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已匯入「長原因草稿」' })).toBeVisible();
  await page.goto('/home');
  await expect(page.getByText(/^草稿：41 種卡片缺少資料/)).toBeVisible();
  await layoutCheck(page, '/home with a long draft reason @ 1280x720');
});
