import { platformHooks } from './platform-hooks';

/** Lets the user save generated text locally (backup / export); nothing leaves the machine. */
export function saveTextFile(fileName: string, text: string, mime = 'application/json'): void {
  const hook = platformHooks().saveText;
  if (hook) {
    // Desktop: the OS "save as" dialog. If it fails, fall back to the browser download so an export is never lost.
    void hook(fileName, text, mime).catch(() => downloadTextFile(fileName, text, mime));
    return;
  }
  downloadTextFile(fileName, text, mime);
}

function downloadTextFile(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeFileName(name: string): string {
  return name.replace(/[/:*?"<>|]/g, '_').trim() || 'export';
}
