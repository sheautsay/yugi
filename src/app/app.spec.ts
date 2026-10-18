import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { DB_NAME } from './core/db';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: DB_NAME, useValue: `shell-${crypto.randomUUID()}` },
      ],
    });
  });

  it('renders the Traditional Chinese navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    // CR-012 (user-requested navigation: 首頁／牌組／起手查詢／AI 展開分析／Combo 管理／設定). The original three
    // destinations keep their exact labels and order; see docs/acceptance-changes.md CR-012 補記 3.
    expect(links).toEqual(['首頁', '牌組', '起手查詢', 'AI 展開分析', 'Combo 管理', '設定']);
    expect(links.filter((l) => ['牌組', 'Combo 管理', '設定'].includes(l!))).toEqual(['牌組', 'Combo 管理', '設定']);
  });

  const pages: Array<[string, string]> = [
    ['/decks', '牌組'],
    ['/decks/no-such-deck', '找不到牌組'],
    ['/decks/x/hand', '起手與 Combo 查詢'],
    ['/combos', 'Combo 管理'],
    ['/combos/new', '新增 Combo'],
    ['/combos/x', '找不到 Combo'],
    ['/combos/x/edit', '找不到 Combo'],
    ['/settings', '設定'],
    ['/no-such-page', '找不到頁面'],
  ];

  for (const [url, heading] of pages) {
    it(`navigates to ${url}`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 0));
        await harness.fixture.whenStable();
      }
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(heading);
    });
  }

  it('redirects the root path to the deck list', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('牌組');
  });
});
