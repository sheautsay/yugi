// Starts the local ChatGPT bridge (CR-005). Usage: npm run chatgpt-bridge
// Tokens are kept in YGO_CHATGPT_DIR (default ~/.ygo-combo-assistant/chatgpt), outside the project.
//
// Desktop mode (`--desktop`, CR-010): the host app starts this as a sidecar and
//   - writes a per-launch secret (one line, >= 32 characters) to stdin; every request must carry it,
//   - lets the system pick the port (YGO_CHATGPT_BRIDGE_PORT=0 is the default in this mode) and reads it
//     from the single stdout line `YGO_BRIDGE_READY {"port":N}`,
//   - ends the bridge when stdin closes, so a crashed or killed host never leaves an orphan behind.
//
// Written without top-level await so it can be bundled into one file for the standalone sidecar executable.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { DEFAULT_PORT, MIN_TOKEN_LENGTH, createBridge } from './bridge.mjs';
import { createEventLog } from './event-log.mjs';

async function main() {
  const desktop = process.argv.includes('--desktop');
  const port = Number(process.env.YGO_CHATGPT_BRIDGE_PORT ?? (desktop ? 0 : DEFAULT_PORT));
  const dataDir = process.env.YGO_CHATGPT_DIR ?? join(homedir(), '.ygo-combo-assistant', 'chatgpt');

  let shuttingDown = false;
  let bridge;
  const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const done = () => process.exit(code);
    if (bridge) void bridge.close().then(done, done);
    else done();
  };

  let token;
  if (desktop) {
    const lines = createInterface({ input: process.stdin });
    token = await new Promise((resolve) => {
      lines.once('line', (line) => resolve(line.trim()));
      lines.once('close', () => resolve(''));
    });
    if (token.length < MIN_TOKEN_LENGTH) {
      console.error('[chatgpt-bridge] desktop mode needs a secret of at least 32 characters on stdin');
      process.exit(2);
    }
    // The host is gone when stdin ends: leave with it.
    process.stdin.on('end', () => shutdown(0));
    process.stdin.on('close', () => shutdown(0));
    process.stdin.on('error', () => shutdown(0));
  }

  // Desktop mode keeps a small event log next to the credentials so a lost sign-in can be explained afterwards
  // (the host discards stdout). The bridge only ever logs event names, status codes and error codes — never tokens.
  const eventLog = desktop ? createEventLog(dataDir) : () => undefined;
  bridge = createBridge({
    port,
    token,
    dataDir,
    log: (event, detail) => {
      console.log(`[chatgpt-bridge] ${event}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
      eventLog(event, detail);
    },
  });

  try {
    await bridge.listen();
  } catch (error) {
    console.error(`[chatgpt-bridge] cannot listen: ${error.code ?? error.message}`);
    process.exit(3);
  }
  console.log(`[chatgpt-bridge] listening on 127.0.0.1:${bridge.port}; credentials folder: ${dataDir}`);
  console.log(`YGO_BRIDGE_READY ${JSON.stringify({ port: bridge.port })}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));
}

main().catch((error) => {
  console.error(`[chatgpt-bridge] failed: ${error?.message ?? error}`);
  process.exit(1);
});
