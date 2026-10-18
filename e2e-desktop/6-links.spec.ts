import { expect, test } from '@playwright/test';
import { goto, launchApp } from './app';

// P0.16 (external links) on the INSTALLED app, with the real opener plugin script and the app's own link routing both
// present. The IPC request that would open the system browser (fetch to http://ipc.localhost/plugin:opener|open_url)
// is answered inside the page, counted and NOT executed, so nothing opens on this machine; opening for real is proven on
// a clean machine (docs/dev/validation/sandbox-win11-2026-10-10). `__TAURI_INTERNALS__.invoke` is read-only and WebView2
// serves ipc.localhost before Playwright's request routing sees it, so the page's own `fetch` is wrapped instead.

const OPEN_URL = 'plugin:opener|open_url';
type Calls = { __openCalls: string[] };

test('P0.16: each https link to another site asks the host to open it exactly once, non-https links are blocked, and the app never navigates away', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/home');
    await expect(page.locator('h1')).toBeVisible();
    await page.evaluate((cmd) => {
      const calls: string[] = [];
      (window as unknown as Calls).__openCalls = calls;
      const original = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes('ipc.localhost') && decodeURIComponent(url).includes(cmd)) {
          const raw = typeof init?.body === 'string' ? init.body : '';
          let target = raw;
          try {
            target = String((JSON.parse(raw) as { url?: unknown }).url);
          } catch {
            target = `(unreadable body: ${raw.slice(0, 80)})`;
          }
          calls.push(target);
          return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json', 'Tauri-Response': 'ok' } });
        }
        return original(input, init);
      };
    }, OPEN_URL);
    // Prove the interception first with a URL the host would refuse anyway (not on the opener allow-list), so a failed
    // interception can never open anything for real.
    const probe = await page.evaluate(async (cmd) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
      return internals.invoke(cmd, { url: 'https://example.com/probe' }).then(() => 'answered by the test', (e: unknown) => `reached the host: ${String(e)}`);
    }, OPEN_URL);
    const calls = () => page.evaluate(() => (window as unknown as Calls).__openCalls.slice());
    expect(await calls(), `the open request is intercepted before any link is clicked (${probe})`).toEqual(['https://example.com/probe']);
    expect(probe).toBe('answered by the test');
    await page.evaluate(() => {
      (window as unknown as Calls).__openCalls.length = 0;
      const add = (id: string, href: string, target?: string) => {
        const a = document.createElement('a');
        a.id = id;
        a.href = href;
        a.textContent = id;
        if (target) a.target = target;
        a.style.cssText = 'position:fixed;left:400px;display:block;padding:8px;background:#fff;color:#000;z-index:9999';
        a.style.top = `${100 + document.querySelectorAll('a[id^="t-"]').length * 40}px`;
        document.body.appendChild(a);
      };
      add('t-blank', 'https://www.youtube.com/watch?v=blank', '_blank');
      add('t-plain', 'https://ygoprodeck.com/plain');
      add('t-middle', 'https://youtu.be/middle', '_blank');
      add('t-http', 'http://example.com/insecure', '_blank');
    });
    const startUrl = page.url();
    await page.click('#t-blank');
    await page.click('#t-plain');
    await page.click('#t-middle', { button: 'middle' });
    await page.click('#t-http');
    await page.waitForTimeout(1000);
    expect(await calls()).toEqual(['https://www.youtube.com/watch?v=blank', 'https://ygoprodeck.com/plain', 'https://youtu.be/middle']);
    expect(page.url()).toBe(startUrl);
    expect(app.browser.contexts().flatMap((c) => c.pages()).filter((p) => !p.url().startsWith('http://tauri.localhost'))).toEqual([]);
  } finally {
    await app.close();
  }
});
