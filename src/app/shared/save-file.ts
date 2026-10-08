/** Lets the user save generated text locally (backup / export); nothing leaves the machine. */
export function saveTextFile(fileName: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'export';
}
