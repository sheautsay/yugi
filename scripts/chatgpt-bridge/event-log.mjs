// Desktop mode: a small event log next to the credentials, so a lost sign-in can be explained afterwards (the host
// discards the service's stdout). The bridge only ever logs event names, status codes and error codes — never tokens,
// authorization codes or URLs — and each line is length-capped here as well.
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const EVENT_LOG_NAME = 'bridge-events.log';

/** Appends `<time> <event> <detail>` lines to bridge-events.log (at most `maxBytes`, one older file kept as `.1`). */
export function createEventLog(dataDir, maxBytes = 256 * 1024, now = () => new Date()) {
  const file = join(dataDir, EVENT_LOG_NAME);
  return (event, detail) => {
    try {
      mkdirSync(dataDir, { recursive: true });
      if (existsSync(file) && statSync(file).size > maxBytes) renameSync(file, `${file}.1`);
      const text = detail === undefined ? '' : ` ${JSON.stringify(detail).slice(0, 300)}`;
      appendFileSync(file, `${now().toISOString()} ${String(event).slice(0, 60)}${text}\n`, { mode: 0o600 });
    } catch {
      // logging must never break the service
    }
  };
}
