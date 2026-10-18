// CR-010: the few places where the desktop app must behave differently from a browser tab
// (open a link in the system browser, save a file through the OS dialog). The browser build installs
// nothing and keeps the original behaviour; the desktop build installs its hooks once at start-up.

export interface PlatformHooks {
  /** Opens an https link outside the app. */
  openExternal?: (url: string) => Promise<void>;
  /** Saves generated text; resolves false when the user cancelled the dialog. */
  saveText?: (fileName: string, text: string, mime: string) => Promise<boolean>;
  /** Brings the app window to the front (after the sign-in finished in the system browser). */
  focusApp?: () => Promise<void>;
}

let installed: PlatformHooks = {};

export function installPlatformHooks(hooks: PlatformHooks): void {
  installed = { ...hooks };
}

export function platformHooks(): PlatformHooks {
  return installed;
}

/** True once the host provides its own way to open links (so no pop-up tab trick is needed). */
/** Desktop: return to the app window. Browser: nothing (the user switches tabs themselves). */
export function focusApp(): void {
  void installed.focusApp?.().catch(() => undefined);
}

export function hasExternalOpener(): boolean {
  return !!installed.openExternal;
}
