import type { Provider } from '@angular/core';
import { setBridgeHints } from '../core/ai/chatgpt';
import { AI_FETCH, AI_PROVIDERS } from '../core/ai/providers';
import { BACKUP_SINK } from '../core/auto-backup.service';
import { CARD_IMAGE_BASE_URL, FETCH_FN } from '../core/card-api';
import { installPlatformHooks } from '../shared/platform-hooks';
import type { DesktopApis } from './desktop-apis';
import { createDesktopBackupSink } from './desktop-backup-sink';
import { createDesktopFetch } from './desktop-fetch';

/** Card images come straight from the image host: the dev-server proxy does not exist in the installed app. */
export const DESKTOP_CARD_IMAGE_BASE = 'https://images.ygoprodeck.com/images';

/** Only https links leave the app; the host's permission list narrows them to the sites the app is allowed to open. */
export function isOpenableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * The opener plugin's injected script already sends a left-clicked `target="_blank"` link to the system browser. It does
 * not cover a middle click (the WebView then drops the new-window request) or a plain external link (which would
 * navigate the app window itself away), and it would pass any http(s) URL on. Every click on a link to another origin
 * is therefore taken over here, in the capture phase, and handed to the system browser; only https links are opened,
 * anything else does nothing. The plugin skips the click because it is already handled, so a link opens once.
 * In-app links are untouched. Returns a function that removes the listeners.
 */
export function routeExternalLinks(root: Document, open: (url: string) => void): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || (event.type === 'click' && event.button !== 0) || (event.type === 'auxclick' && event.button !== 1)) return;
    const start = event.composedPath()[0] ?? event.target;
    const link = start instanceof Element ? start.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;
    let url: URL;
    try {
      url = new URL(link.href, root.baseURI);
    } catch {
      return;
    }
    if (url.origin === new URL(root.baseURI).origin) return;
    event.preventDefault();
    if (isOpenableUrl(url.href)) open(url.href);
  };
  root.addEventListener('click', onClick, true);
  root.addEventListener('auxclick', onClick, true);
  return () => {
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('auxclick', onClick, true);
  };
}

let removeLinkRouting: (() => void) | undefined;

/** Undoes {@link installDesktop}'s process-wide changes (link routing, platform hooks, bridge hints); used by tests. */
export function uninstallDesktop(): void {
  removeLinkRouting?.();
  removeLinkRouting = undefined;
  installPlatformHooks({});
  setBridgeHints(null);
}

/**
 * Switches the app to desktop mode: installs the platform hooks and returns the providers that replace the browser
 * defaults. Called once, before the application starts.
 */
export function installDesktop(apis: DesktopApis): Provider[] {
  const openExternal = async (url: string) => {
    if (!isOpenableUrl(url)) throw new Error('只能開啟 https 網址');
    await apis.openUrl(url);
  };
  removeLinkRouting?.();
  removeLinkRouting = routeExternalLinks(document, (url) => void openExternal(url).catch(() => undefined));
  installPlatformHooks({
    openExternal,
    saveText: (fileName, text) => apis.saveTextFile(fileName, text),
    focusApp: () => apis.invoke<void>('focus_main_window'),
  });
  setBridgeHints({
    down: '本機 ChatGPT 服務沒有回應：App 會自動啟動它，請按「重新整理」再試一次；若仍失敗，請重新開啟 App。',
    preflight: '本機 ChatGPT 服務沒有回應：App 會自動啟動它，請按「重新整理」再試一次',
    managed: true,
  });
  const desktopFetch = createDesktopFetch(apis);
  return [
    { provide: AI_FETCH, useValue: desktopFetch },
    { provide: FETCH_FN, useValue: (url: string) => desktopFetch(url) },
    { provide: CARD_IMAGE_BASE_URL, useValue: DESKTOP_CARD_IMAGE_BASE },
    // CR-011: the user's decision — the ChatGPT account is the only model service in the Windows app.
    { provide: AI_PROVIDERS, useValue: ['chatgpt'] },
    { provide: BACKUP_SINK, useValue: createDesktopBackupSink(apis) },
  ];
}
