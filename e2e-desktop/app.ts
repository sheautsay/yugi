// Drives the INSTALLED Windows app (the release build the NSIS installer put on this machine), not the dev server.
// The WebView2 inside the app is started with a DevTools port (test-only environment variable, never set by the app
// itself), and Playwright attaches to it over CDP. Card data and images come from the REAL YGOPRODeck service through
// the app's own Rust HTTP client.
import { Browser, Page, chromium } from '@playwright/test';
import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const INSTALL_DIR = process.env['YGO_APP_DIR'] ?? join(process.env['LOCALAPPDATA'] ?? '', 'YGO Combo Assistant');
export const APP_EXE = join(INSTALL_DIR, 'ygo-combo-assistant.exe');
export const BRIDGE_EXE_NAME = 'ygo-bridge.exe';
export const DATA_DIR = join(process.env['LOCALAPPDATA'] ?? '', 'com.ygocomboassistant.desktop');
export const BACKUP_DIR_NAME = join('YGO Combo 助手', 'backups');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunningApp {
  browser: Browser;
  page: Page;
  proc: ChildProcess;
  pid: number;
  /** Graceful close (WM_CLOSE, like clicking X) and wait for the process to end. */
  close(): Promise<void>;
  /** Hard kill (like Task Manager → End task), no chance to clean up. */
  kill(): Promise<void>;
}

/** Processes with this image name, as `pid -> parent pid`. */
export function processes(image: string): Map<number, number> {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='${image}'" | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }`], { encoding: 'utf8' });
  const map = new Map<number, number>();
  for (const line of out.split(/\s*\n\s*/)) {
    const [pid, parent] = line.trim().split(' ').map(Number);
    if (pid) map.set(pid, parent);
  }
  return map;
}

export const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export async function waitUntil(check: () => boolean | Promise<boolean>, ms: number, what: string): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(200);
  }
  throw new Error(`timeout: ${what}`);
}

/** No copy of the app may be running: single-instance would hand our launch to it. */
export async function ensureNotRunning(): Promise<void> {
  for (const pid of processes('ygo-combo-assistant.exe').keys()) {
    execFileSync('taskkill', ['/PID', String(pid)], { stdio: 'ignore' });
  }
  await waitUntil(() => processes('ygo-combo-assistant.exe').size === 0, 15000, 'previous app instance to exit');
}

/** Top-level windows of a process (class, type, name, enabled) — for diagnosing a window that will not close. */
export function windowsOf(pid: number): string {
  const script = `Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $A = [Windows.Automation.AutomationElement]
    $A::RootElement.FindAll([Windows.Automation.TreeScope]::Children, (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, ${pid}))) | % {
      $c = $_.Current; $kids = $_.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition) | % { $_.Current.ClassName + ':' + $_.Current.Name }
      "{0} | {1} | name={2} | enabled={3} | children={4}" -f $c.ClassName, $c.ControlType.ProgrammaticName, $c.Name, $c.IsEnabled, ($kids -join ', ') }`;
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-OutputFormat', 'Text', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${script}`], { encoding: 'utf8', timeout: 20000 }).trim();
  } catch (e) {
    return `(could not list: ${String(e)})`;
  }
}

/** Clicks the main window's close button the way a user does (UI Automation WindowPattern.Close). */
export function closeWindow(pid: number): void {
  const script = `Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $A = [Windows.Automation.AutomationElement]
    $w = $A::RootElement.FindFirst([Windows.Automation.TreeScope]::Children, (New-Object Windows.Automation.AndCondition(
      (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, ${pid})),
      (New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty, [Windows.Automation.ControlType]::Window)))))
    if (-not $w) { exit 2 }
    $w.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern).Close()`;
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore', timeout: 20000 });
  } catch {
    execFileSync('taskkill', ['/PID', String(pid)], { stdio: 'ignore' });
  }
}

/** Refuses any path inside the project: a test must never be able to overwrite the source tree. */
export function outsideProject(path: string): string {
  const root = resolve(__dirname, '..').toLowerCase();
  if (resolve(path).toLowerCase().startsWith(root)) throw new Error(`refusing to write inside the project: ${path}`);
  return path;
}

let nextPort = 9330;

export async function launchApp(options: { env?: Record<string, string> } = {}): Promise<RunningApp> {
  if (!existsSync(APP_EXE)) throw new Error(`the app is not installed: ${APP_EXE}`);
  await ensureNotRunning();
  const port = nextPort++;
  const proc = spawn(APP_EXE, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`, ...options.env },
    stdio: 'ignore',
    detached: false,
    // Never the project folder: a file dialog opened by the app must not default to the source tree.
    cwd: tmpdir(),
  });
  const pid = proc.pid!;
  let browser: Browser | undefined;
  const end = Date.now() + 60000;
  while (!browser) {
    if (Date.now() > end) throw new Error('the app did not expose its WebView within 60 s');
    if (proc.exitCode !== null) throw new Error(`the app exited early with ${proc.exitCode}`);
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 2000 });
    } catch {
      await sleep(500);
    }
  }
  let page: Page | undefined;
  await waitUntil(
    () => {
      page = browser!.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('http://tauri.localhost'));
      return !!page;
    },
    30000,
    'the app page',
  );
  await page!.waitForLoadState('domcontentloaded');
  const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  return {
    browser,
    page: page!,
    proc,
    pid,
    close: async () => {
      await browser!.close().catch(() => undefined);
      const started = Date.now();
      closeWindow(pid);
      await Promise.race([exited, sleep(15000)]);
      if (alive(pid)) throw new Error(`the app did not close within 15 s; its windows:\n${windowsOf(pid)}`);
      if (Date.now() - started > 5000) console.log(`# closing the app took ${Date.now() - started} ms`);
    },
    kill: async () => {
      await browser!.close().catch(() => undefined);
      execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
      await Promise.race([exited, sleep(15000)]);
    },
  };
}

/** Navigates inside the app without a reload (the router), like clicking a link. */
export async function goto(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}
