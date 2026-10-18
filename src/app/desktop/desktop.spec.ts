// CR-010: the desktop adapters against a fake host. They prove how the app talks to the host (rewriting, secret,
// restart-on-demand, safe file names); that the real host does this is checked on the installed app (Phase 0/D).
import { TestBed } from '@angular/core/testing';
import { bridgeHints } from '../core/ai/chatgpt';
import { AI_FETCH } from '../core/ai/providers';
import { BACKUP_SINK } from '../core/auto-backup.service';
import { CARD_IMAGE_BASE_URL, FETCH_FN, YgoProDeckClient } from '../core/card-api';
import { platformHooks } from '../shared/platform-hooks';
import { DesktopApis } from './desktop-apis';
import { createDesktopBackupSink } from './desktop-backup-sink';
import { BRIDGE_TOKEN_HEADER, createDesktopFetch } from './desktop-fetch';
import { DESKTOP_CARD_IMAGE_BASE, installDesktop, isOpenableUrl, uninstallDesktop } from './install-desktop';

const TOKEN = 'T'.repeat(40);

function fakeApis(over: Partial<DesktopApis> = {}) {
  const sent: Array<{ url: string; headers: Headers }> = [];
  const files = new Map<string, string>();
  const apis: DesktopApis = {
    fetch: async (input, init) => {
      sent.push({ url: String(input), headers: new Headers(init?.headers) });
      return new Response('ok');
    },
    invoke: async <T>(command: string) => {
      if (command === 'bridge_start') return { port: 51234, token: TOKEN } as T;
      throw new Error(`unknown ${command}`);
    },
    openUrl: async () => undefined,
    saveTextFile: async (name, text) => {
      files.set(`C:\\x\\${name}`, text);
      return true;
    },
    writeText: async (p, t) => void files.set(p, t),
    documentDir: async () => 'D:\\Redirected\\OneDrive\\文件',
    joinPath: async (...parts) => parts.join('\\'),
    mkdir: async () => undefined,
    listNames: async (p) => [...files.keys()].filter((k) => k.startsWith(`${p}\\`)).map((k) => k.slice(p.length + 1)),
    readText: async (p) => {
      const t = files.get(p);
      if (t === undefined) throw new Error('missing');
      return t;
    },
    rename: async (from, to) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    remove: async (p) => void files.delete(p),
    listen: async () => () => undefined,
    windowLabel: () => 'main',
    ...over,
  };
  return { apis, sent, files };
}

afterEach(uninstallDesktop);

describe('desktop fetch (P0.2/P0.4/P0.6 wiring)', () => {
  it('sends ordinary requests through the host untouched', async () => {
    const { apis, sent } = fakeApis();
    await createDesktopFetch(apis)('https://api.anthropic.com/v1/messages', { method: 'POST' });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(sent[0].headers.has(BRIDGE_TOKEN_HEADER)).toBe(false);
  });

  it('never gives the bridge secret to any other host', async () => {
    const { apis, sent } = fakeApis();
    const f = createDesktopFetch(apis);
    await f('/chatgpt-bridge/status');
    await f('https://db.ygoprodeck.com/api/v7/checkDBVer.php');
    await f('http://localhost:11434/api/tags');
    expect(sent.map((s) => [s.url, s.headers.has(BRIDGE_TOKEN_HEADER)])).toEqual([
      ['http://127.0.0.1:51234/status', true],
      ['https://db.ygoprodeck.com/api/v7/checkDBVer.php', false],
      ['http://localhost:11434/api/tags', false],
    ]);
  });

  it('points /chatgpt-bridge at the sidecar port with the per-launch secret and keeps the caller\'s headers and body', async () => {
    const { apis, sent } = fakeApis();
    const f = createDesktopFetch(apis);
    await f('/chatgpt-bridge/responses', { method: 'POST', headers: { 'x-ygo-bridge': '1', 'content-type': 'application/json' }, body: '{}' });
    expect(sent[0].url).toBe('http://127.0.0.1:51234/responses');
    expect(sent[0].headers.get(BRIDGE_TOKEN_HEADER)).toBe(TOKEN);
    expect(sent[0].headers.get('x-ygo-bridge')).toBe('1');
    expect(sent[0].headers.get('content-type')).toBe('application/json');
  });

  it('starts the sidecar once for many calls (even concurrent ones)', async () => {
    const { apis } = fakeApis();
    const invoke = vi.spyOn(apis, 'invoke');
    const f = createDesktopFetch(apis);
    await Promise.all([f('/chatgpt-bridge/status'), f('/chatgpt-bridge/models'), f('/chatgpt-bridge/status')]);
    await f('/chatgpt-bridge/status');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('a crashed sidecar is restarted and a read (GET) is retried once, transparently', async () => {
    let calls = 0;
    const { apis } = fakeApis();
    const origFetch = apis.fetch;
    apis.fetch = async (input, init) => {
      calls++;
      if (calls === 1) throw new TypeError('connection refused');
      return origFetch(input, init);
    };
    const invoke = vi.spyOn(apis, 'invoke');
    const res = await createDesktopFetch(apis)('/chatgpt-bridge/status');
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(invoke).toHaveBeenCalledTimes(2); // asked the host for a (new) sidecar again
  });

  it('an analysis request (POST) is never re-sent automatically after a failure', async () => {
    let calls = 0;
    const { apis } = fakeApis();
    apis.fetch = async () => {
      calls++;
      throw new TypeError('connection refused');
    };
    await expect(createDesktopFetch(apis)('/chatgpt-bridge/responses', { method: 'POST', body: '{}' })).rejects.toThrow('connection refused');
    expect(calls).toBe(1);
  });

  it('asks the host again after the sidecar became unreachable (restart on demand), but not after a user abort', async () => {
    let fail = true;
    const { apis } = fakeApis();
    const origFetch = apis.fetch;
    apis.fetch = async (input, init) => {
      if (fail) throw new TypeError('connection refused');
      return origFetch(input, init);
    };
    const invoke = vi.spyOn(apis, 'invoke');
    const f = createDesktopFetch(apis);
    await expect(f('/chatgpt-bridge/status')).rejects.toThrow('connection refused');
    fail = false;
    await f('/chatgpt-bridge/status');
    expect(invoke).toHaveBeenCalledTimes(2);

    const controller = new AbortController();
    controller.abort();
    fail = true;
    await expect(f('/chatgpt-bridge/status', { signal: controller.signal })).rejects.toThrow();
    fail = false;
    await f('/chatgpt-bridge/status');
    expect(invoke).toHaveBeenCalledTimes(2); // the abort did not discard the running sidecar
  });

  it('a sidecar that cannot start surfaces as a failed call, and the next call tries again', async () => {
    const { apis } = fakeApis();
    let attempts = 0;
    apis.invoke = async <T>() => {
      attempts++;
      if (attempts === 1) throw new Error('cannot start');
      return { port: 51234, token: TOKEN } as T;
    };
    const f = createDesktopFetch(apis);
    await expect(f('/chatgpt-bridge/status')).rejects.toThrow('cannot start');
    await expect(f('/chatgpt-bridge/status')).resolves.toBeInstanceOf(Response);
    expect(attempts).toBe(2);
  });

  it('refuses a malformed answer from the host (short secret, bad port)', async () => {
    for (const bad of [{ port: 0, token: TOKEN }, { port: 70000, token: TOKEN }, { port: 5000, token: 'short' }, null, { port: 5000 }]) {
      const { apis } = fakeApis({ invoke: async <T>() => bad as T });
      await expect(createDesktopFetch(apis)('/chatgpt-bridge/status')).rejects.toThrow('不正確');
    }
  });
});

describe('installDesktop', () => {
  it('replaces the injection points and the user-facing hints, and card images use the image host directly (P0.3)', async () => {
    const { apis, sent } = fakeApis();
    const providers = installDesktop(apis);
    TestBed.configureTestingModule({ providers });
    expect(TestBed.inject(CARD_IMAGE_BASE_URL)).toBe(DESKTOP_CARD_IMAGE_BASE);
    expect(TestBed.inject(BACKUP_SINK)).not.toBeNull();
    expect(bridgeHints().managed).toBe(true);
    expect(bridgeHints().down).not.toContain('npm');
    expect(bridgeHints().preflight).not.toContain('終端機');

    const aiFetch = TestBed.inject(AI_FETCH);
    await aiFetch('/chatgpt-bridge/status');
    expect(sent[0].url).toBe('http://127.0.0.1:51234/status');
    await TestBed.inject(FETCH_FN)('https://db.ygoprodeck.com/api/v7/checkDBVer.php');
    expect(sent[1].url).toContain('db.ygoprodeck.com');

    // The real client builds image URLs from the injected base — no dev-server proxy path.
    const client = TestBed.inject(YgoProDeckClient);
    apis.fetch = async (input) => {
      sent.push({ url: String(input), headers: new Headers() });
      return new Response('jpeg', { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    };
    const blob = await client.fetchImage(32061192, 'small');
    expect(blob.type).toBe('image/jpeg');
    expect(sent.at(-1)!.url).toBe('https://images.ygoprodeck.com/images/cards_small/32061192.jpg');
  });

  it('opens only https links without credentials', () => {
    expect(isOpenableUrl('https://chatgpt.com/settings/usage')).toBe(true);
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'file:///C:/Windows/win.ini', 'https://user:pw@example.com/', 'ms-msdt:/id', 'not a url', '']) {
      expect(isOpenableUrl(bad)).toBe(false);
    }
  });

  it('the installed hooks open links through the host and save through the dialog; a cancelled dialog writes nothing', async () => {
    const { apis, files } = fakeApis();
    const openUrl = vi.spyOn(apis, 'openUrl');
    installDesktop(apis);
    await platformHooks().openExternal!('https://www.db.yugioh-card.com/x');
    expect(openUrl).toHaveBeenCalledWith('https://www.db.yugioh-card.com/x');
    await expect(platformHooks().openExternal!('http://evil.example')).rejects.toThrow('https');
    expect(openUrl).toHaveBeenCalledTimes(1);

    expect(await platformHooks().saveText!('a.json', '{"a":1}', 'application/json')).toBe(true);
    expect(files.get('C:\\x\\a.json')).toBe('{"a":1}');
    apis.saveTextFile = async () => false;
    files.clear();
    expect(await platformHooks().saveText!('b.json', '{}', 'application/json')).toBe(false);
    expect(files.size).toBe(0);
  });
});

describe('desktop backup folder (D6)', () => {
  it('lives under the Documents folder Windows reports — also when it is redirected — not a fixed path', async () => {
    const { apis } = fakeApis();
    const sink = createDesktopBackupSink(apis);
    expect(await sink.directory()).toBe('D:\\Redirected\\OneDrive\\文件\\YGO Combo 助手\\backups');
  });

  it('writes through a temporary name and leaves no temporary file; list hides in-flight temporaries', async () => {
    const { apis, files } = fakeApis();
    const sink = createDesktopBackupSink(apis);
    await sink.write('ygo-backup-20261001-103000.json', '{"x":1}');
    expect([...files.keys()]).toEqual(['D:\\Redirected\\OneDrive\\文件\\YGO Combo 助手\\backups\\ygo-backup-20261001-103000.json']);
    files.set('D:\\Redirected\\OneDrive\\文件\\YGO Combo 助手\\backups\\ygo-backup-20261002-103000.json.tmp', 'half');
    expect(await sink.list()).toEqual(['ygo-backup-20261001-103000.json']);
    expect(await sink.read('ygo-backup-20261001-103000.json')).toBe('{"x":1}');
  });

  it('a failed rename removes the temporary file and reports the error', async () => {
    const { apis, files } = fakeApis({ rename: async () => Promise.reject(new Error('locked')) });
    const sink = createDesktopBackupSink(apis);
    await expect(sink.write('ygo-backup-20261001-103000.json', 'x')).rejects.toThrow('locked');
    expect(files.size).toBe(0);
  });

  it('rejects names that could leave the folder', async () => {
    const { apis } = fakeApis();
    const sink = createDesktopBackupSink(apis);
    for (const bad of ['..\\x.json', '../x.json', 'a\\b.json', 'C:\\Windows\\x', '']) {
      await expect(sink.read(bad)).rejects.toThrow('不合法');
      await expect(sink.remove(bad)).rejects.toThrow('不合法');
    }
  });
});
