import type { FetchLike } from '../core/ai/providers';
import type { CapturedFrame } from '../shared/platform-hooks';

/**
 * Everything the desktop build needs from the host (Tauri 2), as plain functions. The adapters in this folder only
 * talk to this interface, so they are unit-tested with fakes; {@link loadTauriApis} is the only file that touches
 * the real plugins.
 */
export interface DesktopApis {
  /** `@tauri-apps/plugin-http` fetch: sent by the host process, so no browser CORS (it does send an Origin header: the app origin tauri.localhost). */
  fetch: FetchLike;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  openUrl(url: string): Promise<void>;
  /** The Windows "save as" dialog, then writes the text to the chosen file; false when the user cancelled. */
  saveTextFile(defaultName: string, text: string): Promise<boolean>;
  writeText(path: string, text: string): Promise<void>;
  /** The user's Documents folder as Windows reports it (follows OneDrive/known-folder redirection). */
  documentDir(): Promise<string>;
  joinPath(...parts: string[]): Promise<string>;
  mkdir(path: string): Promise<void>;
  /** Plain file names inside a folder (empty when the folder does not exist yet). */
  listNames(path: string): Promise<string[]>;
  readText(path: string): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Subscribes to an event the host sends to this window; resolves to a function that stops listening. */
  listen(event: string, handler: () => void): Promise<() => void>;
}

/** Host event sent to the window that should capture when the capture shortcut is pressed (B4). */
export const CAPTURE_SHORTCUT_EVENT = 'game-capture-shortcut';

/**
 * The bytes `capture_game_window` returns: width and height as little-endian u32, then RGBA pixels (B4). Throws when the
 * buffer is not a complete frame.
 */
export function parseFrame(buffer: ArrayBuffer): CapturedFrame {
  if (buffer.byteLength < 8) throw new Error('截圖資料不完整');
  const view = new DataView(buffer);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  if (!width || !height || buffer.byteLength !== 8 + width * height * 4) throw new Error('截圖資料不完整');
  return { width, height, rgba: new Uint8ClampedArray(buffer, 8) };
}

/** Set by the Tauri runtime on the window; absent in a normal browser. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Loads the real Tauri plugins. Only called when {@link isTauriRuntime} is true. */
export async function loadTauriApis(): Promise<DesktopApis> {
  const [core, path, http, opener, fs, webview] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-http'),
    import('@tauri-apps/plugin-opener'),
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/webviewWindow'),
  ]);
  return {
    fetch: http.fetch as FetchLike,
    invoke: (command, args) => core.invoke(command, args),
    openUrl: (url) => opener.openUrl(url),
    saveTextFile: (defaultName, text) => core.invoke<boolean>('save_text_file', { defaultName, text }),
    writeText: (p, text) => fs.writeTextFile(p, text),
    documentDir: () => path.documentDir(),
    joinPath: (...parts) => path.join(...parts),
    mkdir: (p) => fs.mkdir(p, { recursive: true }),
    listNames: async (p) => ((await fs.exists(p)) ? (await fs.readDir(p)).filter((e) => e.isFile).map((e) => e.name) : []),
    readText: (p) => fs.readTextFile(p),
    rename: (from, to) => fs.rename(from, to),
    remove: (p) => fs.remove(p),
    // Only events addressed to this window: the host picks the window that should react to the shortcut.
    listen: (event, handler) => webview.getCurrentWebviewWindow().listen(event, () => handler()),
  };
}
