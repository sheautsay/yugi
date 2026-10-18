// Test helper for bridge-desktop.test.mjs and scripts/desktop/sidecar.test.mjs: stands in for the desktop app. It
// starts the bridge the way the app does (--desktop, secret on stdin), prints `HOST <bridge pid> <port>` and then
// idles until it is killed.
// Usage: node fake-host.helper.test.mjs <main.mjs | standalone .exe> <data dir> <secret>
import { spawn } from 'node:child_process';

const [target, dataDir, secret] = process.argv.slice(2);
const standalone = target.toLowerCase().endsWith('.exe');
const bridge = spawn(standalone ? target : process.execPath, standalone ? ['--desktop'] : [target, '--desktop'], {
  // The standalone build must not depend on any Node.js being installed: give it a bare PATH.
  env: { ...process.env, YGO_CHATGPT_DIR: dataDir, ...(standalone ? { PATH: process.env.SystemRoot ? `${process.env.SystemRoot}\System32` : '' } : {}) },
  stdio: ['pipe', 'pipe', 'inherit'],
});
bridge.stdin.write(`${secret}\n`);
bridge.stdout.on('data', (chunk) => {
  const m = /YGO_BRIDGE_READY (\{.*\})/.exec(String(chunk));
  if (m) console.log(`HOST ${bridge.pid} ${JSON.parse(m[1]).port}`);
});
setInterval(() => {}, 1000);
