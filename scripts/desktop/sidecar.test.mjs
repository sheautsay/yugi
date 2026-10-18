// P0.9 / P0.13 / P0.6 against the REAL standalone executable (needs `npm run desktop:sidecar` first).
// It runs with a bare PATH, so it proves the executable carries its own Node runtime.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { EOL, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

const EXE = fileURLToPath(new URL('../../src-tauri/binaries/ygo-bridge-x86_64-pc-windows-msvc.exe', import.meta.url));
const HELPER = fileURLToPath(new URL('../chatgpt-bridge/fake-host.helper.test.mjs', import.meta.url));
const TOKEN = 'z'.repeat(20) + 'Q'.repeat(20);
const barePath = () => `${process.env.SystemRoot}\System32`;

const raw = (port, headers) =>
  new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/status', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
const within = (p, ms, what) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout: ${what}`)), ms))]);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let dir;
beforeEach(async () => {
  assert.ok(existsSync(EXE), `build the sidecar first: npm run desktop:sidecar (${EXE})`);
  dir = await mkdtemp(join(tmpdir(), 'ygo-sidecar-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

function start() {
  const child = spawn(EXE, ['--desktop'], { env: { PATH: barePath(), SystemRoot: process.env.SystemRoot, YGO_CHATGPT_DIR: dir }, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  const ready = new Promise((resolve, reject) => {
    createInterface({ input: child.stdout }).on('line', (line) => {
      const m = /^YGO_BRIDGE_READY (\{.*\})$/.exec(line);
      if (m) resolve(JSON.parse(m[1]).port);
    });
    void exited.then((code) => reject(new Error(`exited ${code} before READY`)));
  });
  ready.catch(() => undefined);
  child.stdin.write(`${TOKEN}\n`);
  return { child, ready, exited };
}

const listening = (pid) => {
  // Windows `netstat -ano`: the sockets this process listens on.
  const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
  return out
    .split(EOL)
    .map((l) => l.trim().split(' ').filter(Boolean))
    .filter((c) => c[0] === 'TCP' && c[3] === 'LISTENING' && Number(c[4]) === pid)
    .map((c) => c[1]);
};

describe('standalone ygo-bridge executable', () => {
  it('starts with no Node.js on PATH, picks a port, and only answers requests that carry the secret', async () => {
    const s = start();
    try {
      const port = await within(s.ready, 15000, 'ready');
      assert.ok(port > 0);
      assert.equal(await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': TOKEN }), 200);
      assert.equal(await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1' }), 401);
      assert.equal(await raw(port, { host: `127.0.0.1:${port}`, 'x-ygo-bridge': '1', 'x-ygo-bridge-token': 'x'.repeat(40) }), 401);
    } finally {
      s.child.kill();
      await s.exited;
    }
  });

  it('listens on 127.0.0.1 only (netstat shows no other address, no wildcard)', async () => {
    const s = start();
    try {
      const port = await within(s.ready, 15000, 'ready');
      const sockets = listening(s.child.pid);
      console.log(`# netstat LISTENING for pid ${s.child.pid}: ${sockets.join(', ')}`);
      assert.deepEqual(sockets, [`127.0.0.1:${port}`]);
    } finally {
      s.child.kill();
      await s.exited;
    }
  });

  it('ends when stdin closes', async () => {
    const s = start();
    await within(s.ready, 15000, 'ready');
    s.child.stdin.end();
    assert.equal(await within(s.exited, 8000, 'exit'), 0);
  });

  it('is not left behind when its host is terminated with no chance to clean up', async () => {
    const host = spawn(process.execPath, [HELPER, EXE, dir, TOKEN], { stdio: ['ignore', 'pipe', 'inherit'] });
    const hostExited = new Promise((resolve) => host.once('exit', resolve));
    const info = await within(
      new Promise((resolve) => {
        createInterface({ input: host.stdout }).on('line', (line) => {
          const m = /^HOST (\d+) (\d+)$/.exec(line);
          if (m) resolve({ pid: Number(m[1]), port: Number(m[2]) });
        });
      }),
      15000,
      'host ready',
    );
    assert.ok(alive(info.pid));
    host.kill('SIGKILL');
    await hostExited;
    const deadline = Date.now() + 8000;
    while (alive(info.pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    assert.ok(!alive(info.pid), 'the standalone bridge outlived its host');
  });
});
