// CR-010 / P0.4–P0.8, P0.13: the bridge in desktop mode — per-launch secret, loopback only,
// dynamic port, and ending together with its host. No request here reaches OpenAI.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createBridge } from './bridge.mjs';

const MAIN = fileURLToPath(new URL('./main.mjs', import.meta.url));
const FAKE_HOST = fileURLToPath(new URL('./fake-host.helper.test.mjs', import.meta.url));
const TOKEN = 'a'.repeat(16) + 'B'.repeat(16) + '0123456789';

function raw(port, headers, { path = '/status', method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ygo-bridge-desktop-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('P0.6 per-launch secret (not "no Origin")', () => {
  let bridge;
  beforeEach(async () => {
    bridge = createBridge({ port: 0, token: TOKEN, dataDir: dir, log: () => {} });
    await bridge.listen();
  });
  afterEach(() => bridge.close());

  const host = () => `127.0.0.1:${bridge.port}`;

  it('rejects every request without the secret — also one with no Origin and the V1 header', async () => {
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1' }), 401);
    assert.equal(await raw(bridge.port, { host: host() }), 401);
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', origin: 'http://localhost:4200' }), 401);
  });

  it('rejects a wrong secret, including a prefix and a longer one', async () => {
    for (const wrong of ['x'.repeat(TOKEN.length), TOKEN.slice(0, -1), `${TOKEN}x`, '', ' ']) {
      assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': wrong }), 401, JSON.stringify(wrong));
    }
  });

  it('accepts the right secret together with the V1 header', async () => {
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 200);
  });

  it('the secret alone is not enough: the V1 header is still required', async () => {
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge-token': TOKEN }), 403);
  });

  it('a foreign Host or Origin is still refused even with the right secret', async () => {
    assert.equal(await raw(bridge.port, { host: `evil.example:${bridge.port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 403);
    assert.equal(await raw(bridge.port, { host: `localhost:${bridge.port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 403);
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN, origin: 'https://evil.example' }), 403);
  });

  it('the desktop app\'s own origin (tauri.localhost, sent by its HTTP plugin) is accepted only with the secret', async () => {
    // Found on the installed app: @tauri-apps/plugin-http sends Origin: http://tauri.localhost.
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN, origin: 'http://tauri.localhost' }), 200);
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN, origin: 'https://tauri.localhost' }), 200);
    assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', origin: 'http://tauri.localhost' }), 401);
    for (const fake of ['http://tauri.localhost.evil.example', 'http://evil.tauri.localhost', 'http://tauri.localhost:8080', 'null']) {
      assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN, origin: fake }), 403, fake);
    }
  });

  it("the browser OAuth callback needs no secret (it is reached by the user's browser)", async () => {
    // No pending sign-in → the page reports a state mismatch (400), not "unauthorized" (401).
    assert.equal(await raw(bridge.port, { host: host() }, { path: '/auth/callback?state=x&code=y' }), 400);
  });

  it('the secret is never written to the credentials folder, even after sign-in started and files were created', async () => {
    const call = (path, method) =>
      new Promise((resolve, reject) => {
        const req = httpRequest({ host: '127.0.0.1', port: bridge.port, path, method, headers: { host: host(), 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN, 'content-type': 'application/json' } }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end(method === 'POST' ? '{}' : undefined);
      });
    const start = await call('/auth/start', 'POST');
    assert.equal(start.status, 200);
    assert.ok(!start.body.includes(TOKEN), 'the secret was returned to the caller');
    assert.ok(!start.body.includes('x-ygo-bridge-token'));
    const names = await readdir(dir);
    assert.ok(names.length > 0, 'the host id file should exist after sign-in started');
    for (const name of names) assert.ok(!(await readFile(join(dir, name), 'utf8')).includes(TOKEN), `secret found in ${name}`);
  });

  it('every other path also needs the secret', async () => {
    for (const [path, method] of [['/models', 'GET'], ['/responses', 'POST'], ['/auth/start', 'POST'], ['/auth/logout', 'POST'], ['/nope', 'GET']]) {
      assert.equal(await raw(bridge.port, { host: host(), 'x-ygo-bridge': '1' }, { path, method }), 401, path);
    }
  });
});

describe('secret handling', () => {
  it('refuses a missing or short secret when one is supplied', () => {
    for (const bad of ['', 'short', 'x'.repeat(31), 123, null]) {
      assert.throws(() => createBridge({ port: 0, token: bad, dataDir: dir }), /token/);
    }
  });

  it('without a secret the V1 behaviour is unchanged (header + local origin)', async () => {
    const bridge = createBridge({ port: 0, dataDir: dir, log: () => {} });
    await bridge.listen();
    try {
      assert.equal(await raw(bridge.port, { host: `127.0.0.1:${bridge.port}`, 'x-ygo-bridge': '1' }), 200);
      assert.equal(await raw(bridge.port, { host: `127.0.0.1:${bridge.port}` }), 403);
      // The desktop origin means nothing without desktop mode.
      assert.equal(await raw(bridge.port, { host: `127.0.0.1:${bridge.port}`, 'x-ygo-bridge': '1', origin: 'http://tauri.localhost' }), 403);
    } finally {
      await bridge.close();
    }
  });
});

/** Starts main.mjs --desktop as a child and resolves `ready` once it printed the READY line. */
function startDesktop({ token = TOKEN, env = {}, writeToken = true } = {}) {
  const child = spawn(process.execPath, [MAIN, '--desktop'], {
    env: { ...process.env, YGO_CHATGPT_DIR: dir, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const out = [];
  const err = [];
  child.stderr.on('data', (d) => err.push(String(d)));
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  const ready = new Promise((resolve, reject) => {
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      out.push(line);
      const m = /^YGO_BRIDGE_READY (\{.*\})$/.exec(line);
      if (m) resolve(JSON.parse(m[1]).port);
    });
    void exited.then(({ code }) => reject(new Error(`exited ${code} before READY: ${err.join('')}`)));
  });
  ready.catch(() => undefined); // an expected early exit is asserted through `exited`
  if (writeToken) child.stdin.write(`${token}\n`);
  return { child, ready, exited, out, err };
}

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

describe('P0.4/P0.8 sidecar start, dynamic port, loopback', () => {
  it('reports a system-chosen port and answers only with the secret', async () => {
    const a = startDesktop();
    const b = startDesktop();
    try {
      const [pa, pb] = await withTimeout(Promise.all([a.ready, b.ready]), 10000, 'ready');
      assert.ok(pa > 0 && pb > 0 && pa !== pb, `ports ${pa} ${pb}`);
      assert.equal(await raw(pa, { host: `127.0.0.1:${pa}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 200);
      assert.equal(await raw(pa, { host: `127.0.0.1:${pa}`, 'x-ygo-bridge': '1' }), 401);
    } finally {
      a.child.kill();
      b.child.kill();
      await Promise.all([a.exited, b.exited]);
    }
  });

  it("listens on 127.0.0.1 only: the machine's other addresses refuse the connection", async () => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    const s = startDesktop();
    try {
      const port = await withTimeout(s.ready, 10000, 'ready');
      assert.equal(await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 200);
      for (const address of lan) {
        const result = await new Promise((resolve) => {
          const req = httpRequest({ host: address, port, path: '/status', headers: { 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }, timeout: 3000 }, (res) => {
            res.resume();
            resolve(`HTTP ${res.statusCode}`);
          });
          req.on('error', (e) => resolve(e.code ?? 'error'));
          req.on('timeout', () => {
            req.destroy();
            resolve('timeout');
          });
          req.end();
        });
        assert.doesNotMatch(result, /^HTTP/, `reachable on ${address}: ${result}`);
      }
      console.log(`# loopback check: tested ${lan.length} non-loopback address(es): ${lan.join(', ') || '(none)'}`);
    } finally {
      s.child.kill();
      await s.exited;
    }
  });

  it('the secret never appears in stdout or stderr', async () => {
    const s = startDesktop();
    try {
      const port = await withTimeout(s.ready, 10000, 'ready');
      await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': 'wrong'.padEnd(40, 'z') });
      await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN });
    } finally {
      s.child.kill();
      await s.exited;
    }
    const all = [...s.out, ...s.err].join('\n');
    assert.ok(!all.includes(TOKEN), 'the secret was logged');
  });

  it('a port that is already taken ends with exit code 3 and a readable message', async () => {
    const first = startDesktop({ env: { YGO_CHATGPT_BRIDGE_PORT: '0' } });
    const port = await withTimeout(first.ready, 10000, 'ready');
    const second = startDesktop({ env: { YGO_CHATGPT_BRIDGE_PORT: String(port) } });
    try {
      const { code } = await withTimeout(second.exited, 10000, 'second exit');
      assert.equal(code, 3);
      assert.match(second.err.join(''), /cannot listen: EADDRINUSE/);
    } finally {
      first.child.kill();
      await first.exited;
    }
  });
});

describe('P0.13 the sidecar ends with its host', () => {
  it('exits when stdin closes (host gone) — also without any signal', async () => {
    const s = startDesktop();
    await withTimeout(s.ready, 10000, 'ready');
    s.child.stdin.end();
    const { code } = await withTimeout(s.exited, 5000, 'exit after stdin close');
    assert.equal(code, 0);
  });

  it('is not left behind when its host is killed hard (no chance to clean up)', async () => {
    const host = spawn(process.execPath, [FAKE_HOST, MAIN, dir, TOKEN], { stdio: ['ignore', 'pipe', 'inherit'] });
    const hostExited = new Promise((resolve) => host.once('exit', resolve));
    const info = await withTimeout(
      new Promise((resolve) => {
        createInterface({ input: host.stdout }).on('line', (line) => {
          const m = /^HOST (\d+) (\d+)$/.exec(line);
          if (m) resolve({ pid: Number(m[1]), port: Number(m[2]) });
        });
      }),
      10000,
      'host ready',
    );
    const alive = (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    assert.ok(alive(info.pid), 'the bridge should be running while its host lives');
    assert.equal(await raw(info.port, { host: `127.0.0.1:${info.port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 200);
    host.kill('SIGKILL'); // Windows: TerminateProcess on the host only; the bridge gets no signal
    await hostExited;
    const deadline = Date.now() + 8000;
    while (alive(info.pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    assert.ok(!alive(info.pid), 'the bridge was left running after its host was killed');
  });

  it('exits on SIGTERM too', async () => {
    const s = startDesktop();
    await withTimeout(s.ready, 10000, 'ready');
    s.child.kill('SIGTERM');
    await withTimeout(s.exited, 5000, 'exit after SIGTERM');
  });

  it('refuses to start without a valid secret on stdin (exit code 2)', async () => {
    const s = startDesktop({ token: 'too-short' });
    assert.equal((await withTimeout(s.exited, 5000, 'exit')).code, 2);
    const s2 = startDesktop({ writeToken: false });
    s2.child.stdin.end();
    assert.equal((await withTimeout(s2.exited, 5000, 'exit')).code, 2);
  });
});
