// Hardening (not a reported defect): the opener plugin's script handles only a left-clicked target="_blank" link; a
// middle click, a plain external link (it would navigate the app window away) and non-https links are covered here.
import { DesktopApis } from './desktop-apis';
import { installDesktop, routeExternalLinks, uninstallDesktop } from './install-desktop';

function link(href: string, target?: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = 'x';
  if (target) a.target = target;
  document.body.appendChild(a);
  return a;
}

function click(el: Element, init: MouseEventInit = {}, type = 'click'): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(event);
  return event;
}

describe('routeExternalLinks', () => {
  let opened: string[];
  let stop: () => void;
  beforeEach(() => {
    opened = [];
    stop = routeExternalLinks(document, (url) => opened.push(url));
  });
  afterEach(() => {
    stop();
    document.body.innerHTML = '';
  });

  it('hands a target="_blank" https link to the system browser (once: the opener plugin sees it as already handled)', () => {
    const event = click(link('https://chatgpt.com/settings/usage', '_blank'));
    expect(event.defaultPrevented).toBe(true);
    expect(opened).toEqual(['https://chatgpt.com/settings/usage']);
  });

  it('also takes over a plain external link (the app window must never navigate away) and a middle click', () => {
    expect(click(link('https://www.youtube.com/watch?v=abc')).defaultPrevented).toBe(true);
    expect(click(link('https://youtu.be/abc', '_blank'), { button: 1 }, 'auxclick').defaultPrevented).toBe(true);
    expect(opened).toEqual(['https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc']);
  });

  it('a click on an element inside the link counts as a click on the link', () => {
    const a = link('https://ygoprodeck.com/card/x', '_blank');
    const span = document.createElement('span');
    a.appendChild(span);
    click(span);
    expect(opened).toEqual(['https://ygoprodeck.com/card/x']);
  });

  it('leaves in-app links to the router and opens nothing', () => {
    const event = click(link(`${location.origin}/decks`));
    expect(event.defaultPrevented).toBe(false);
    expect(opened).toEqual([]);
  });

  it('blocks non-https external links without opening them', () => {
    for (const href of ['http://example.com/', 'ftp://example.com/x']) {
      expect(click(link(href, '_blank')).defaultPrevented).toBe(true);
    }
    expect(opened).toEqual([]);
  });

  it('ignores right clicks and clicks another handler already took', () => {
    click(link('https://chatgpt.com/', '_blank'), { button: 2 });
    const a = link('https://chatgpt.com/x', '_blank');
    a.addEventListener('click', (e) => e.preventDefault(), { capture: false });
    // Capture-phase routing runs first; a handler that cancelled earlier (defaultPrevented on arrival) is respected.
    const pre = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    pre.preventDefault();
    a.dispatchEvent(pre);
    expect(opened).toEqual([]);
  });

  it('stops after the returned function is called', () => {
    stop();
    expect(click(link('https://chatgpt.com/', '_blank')).defaultPrevented).toBe(false);
    expect(opened).toEqual([]);
  });
});

describe('installDesktop link routing', () => {
  afterEach(uninstallDesktop);

  it('routes external links through the host opener, and installing twice does not open a link twice', async () => {
    const urls: string[] = [];
    const apis = { openUrl: async (u: string) => void urls.push(u) } as unknown as DesktopApis;
    installDesktop(apis);
    installDesktop(apis);
    link('https://www.db.yugioh-card.com/yugiohdb/', '_blank').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(urls).toEqual(['https://www.db.yugioh-card.com/yugiohdb/']);
    document.body.innerHTML = '';
  });
});
