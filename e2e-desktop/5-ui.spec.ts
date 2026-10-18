import { expect, test } from '@playwright/test';
import { TOKENS } from '../e2e/fixtures';
import { goto, launchApp } from './app';

// CR-012 UI acceptance on the INSTALLED app (production build inside WebView2): UI2 (same design as the dev build:
// identical tokens asserted in e2e/ui.spec.ts), UI3 (stylesheets/fonts/icons load, no CSP or resource errors),
// UI4 (no browser-default links), UI13 (window sizes and scaling, emulated in the real WebView2 renderer).

test.describe.configure({ mode: 'serial' });

const SIZES = [
  { width: 1280, height: 720, scale: 1 },
  { width: 1366, height: 768, scale: 1 },
  { width: 1920, height: 1080, scale: 1 },
  { width: 1280, height: 720, scale: 1.25 },
  { width: 1280, height: 720, scale: 1.5 },
];

test('UI2 / UI3 / UI4 / UI13 on the installed app: every main page uses the design tokens, has no default links, no CSP/resource errors, and fits every window size', async () => {
  test.setTimeout(300_000);
  const app = await launchApp();
  try {
    const { page } = app;
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text());
    });
    page.on('requestfailed', (r) => {
      if (r.url().startsWith('http://tauri.localhost')) problems.push(`failed to load ${r.url()}`);
    });
    // Collect the routes from the app itself (the first deck and combo it has).
    await goto(page, '/decks');
    await page.locator('.deck-row').first().waitFor();
    const deckHref = await page.locator('.deck-row').first().getByRole('link', { name: '編輯' }).getAttribute('href');
    await goto(page, '/combos');
    await page.waitForTimeout(500);
    const comboHref = await page.locator('.combo-row a').first().getAttribute('href').catch(() => null);
    const routes = ['/home', '/decks', deckHref!, `${deckHref}/hand`, `${deckHref}/analysis`, '/combos', ...(comboHref ? [comboHref] : []), '/settings'];
    const cdp = await page.context().newCDPSession(page);
    for (const s of SIZES) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: s.width, height: s.height, deviceScaleFactor: s.scale, mobile: false });
      for (const route of routes) {
        await goto(page, route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const visible = (el: Element) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          };
          const defaultBlue = ['rgb(0, 0, 238)', 'rgb(85, 26, 139)'];
          const primary = document.querySelector('button.primary, a.button.primary');
          return {
            bg: getComputedStyle(document.body).backgroundColor,
            text: getComputedStyle(document.body).color,
            primary: primary ? getComputedStyle(primary).backgroundColor : null,
            badLinks: [...document.querySelectorAll('a')].filter(visible).filter((a) => defaultBlue.includes(getComputedStyle(a).color)).length,
            underlinedNav: [...document.querySelectorAll('nav a, a.button, .page-links a')].filter(visible).filter((a) => getComputedStyle(a).textDecorationLine.includes('underline')).length,
            icons: [...document.querySelectorAll('app-icon svg')].filter(visible).length,
            scroll: document.documentElement.scrollWidth,
            inner: innerWidth,
            clipped: [...document.querySelectorAll('button, a.button')].filter(visible).filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1).map((el) => el.textContent?.trim()),
            blockedStyles: [...document.querySelectorAll('style')].filter((st) => (st.textContent?.length ?? 0) > 20 && (st.sheet?.cssRules.length ?? 0) === 0).length,
          };
        });
        const where = `${route} @ ${s.width}x${s.height}x${s.scale}`;
        expect(r.bg, where).toBe(TOKENS.bg);
        expect(r.text, where).toBe(TOKENS.text);
        if (r.primary) expect(r.primary, where).toBe(TOKENS.primary);
        expect(r.badLinks, `${where}: default-coloured links`).toBe(0);
        expect(r.underlinedNav, `${where}: underlined navigation`).toBe(0);
        expect(r.icons, `${where}: navigation icons`).toBeGreaterThanOrEqual(6);
        expect(r.scroll, `${where}: horizontal scroll`).toBeLessThanOrEqual(r.inner);
        expect(r.clipped, `${where}: clipped buttons`).toEqual([]);
        expect(r.blockedStyles, `${where}: blocked stylesheets`).toBe(0);
      }
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    expect(problems).toEqual([]);
  } finally {
    await app.close();
  }
});
