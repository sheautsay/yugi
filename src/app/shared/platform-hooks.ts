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
  /** B4: one picture of the Master Duel window, kept in memory only (desktop only). */
  captureGame?: () => Promise<CapturedFrame>;
  /** B4: sets (or with null, removes) the system-wide shortcut that asks for a capture (desktop only). */
  setCaptureShortcut?: (accelerator: string | null) => Promise<void>;
  /** B4: calls `handler` each time the capture shortcut is pressed; returns a function that stops listening. */
  onCaptureShortcut?: (handler: () => void) => () => void;
}

/** A captured window as raw RGBA pixels (4 bytes per pixel, row by row). */
export interface CapturedFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
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

/** B4: true when the host can capture the game window (the Windows app). */
export function canCaptureGame(): boolean {
  return !!installed.captureGame;
}
