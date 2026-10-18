import { platformHooks } from './platform-hooks';

/** Opens a link in a new tab (browser) or the system browser (desktop). Never gives the page access to this app. */
export function openExternal(url: string): void {
  const hook = platformHooks().openExternal;
  if (hook) {
    void hook(url).catch(() => undefined);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
