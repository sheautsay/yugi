// G11 audit: no git remote, no unapproved network endpoints, no game/screen/credential access.
// Usage: node scripts/g11-audit.mjs   (exit code 1 on any violation)
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const decode = (p) => decodeURIComponent(p);
const projectRoot = decode(root);

// Hosts the app may contact (spec §2 card data source; CR-004 optional user-configured Claude API —
// the local Ollama option uses localhost) or merely link to (F09 source URL whitelist).
const FETCH_HOSTS = ['db.ygoprodeck.com', 'images.ygoprodeck.com', 'api.anthropic.com'];
const LINK_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.bilibili.com',
  'ygoprodeck.com',
  'www.masterduelmeta.com',
  'masterduelmeta.com',
  'www.db.yugioh-card.com',
  'chatgpt.com', // CR-005 "Manage usage" link
];
// Loopback only: 'localhost' (dev server, Ollama) and '127.0.0.1' (the ChatGPT bridge, CR-005).
const ALLOWED_HOSTS = new Set([...FETCH_HOSTS, ...LINK_HOSTS, 'localhost', '127.0.0.1']);
// CR-005: only the local ChatGPT bridge may contact OpenAI (sign-in, tokens, models, Responses).
const BRIDGE_DIR = 'scripts/chatgpt-bridge';
const BRIDGE_HOSTS = new Set(['auth.openai.com', 'api.openai.com', '127.0.0.1']);
const BRIDGE_ONLY = /\b(auth|api)\.openai\.com\b/;

const FORBIDDEN = [
  [/getDisplayMedia|getUserMedia|captureStream/, 'screen/camera capture API'],
  [/\beval\s*\(|new\s+Function\s*\(/, 'dynamic code execution'],
  [/\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|bypassSecurityTrust/, 'raw HTML injection'],
  [/document\.cookie/, 'cookie access'],
  [/\bWebSocket\b|\bEventSource\b|sendBeacon/, 'unapproved network channel'],
  [/child_process|ReadProcessMemory|OpenProcess|steamapps/i, 'process/game access'],
];

const violations = [];
const notes = [];

const remotes = execSync('git remote -v', { cwd: projectRoot }).toString().trim();
if (remotes) violations.push(`git remote -v is not empty:\n${remotes}`);
else notes.push('git remote -v: (empty)');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|html|json|mjs|mts|css)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(join(projectRoot, 'src')), join(projectRoot, 'proxy.conf.json')].filter((f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
});

const fetchSites = [];
for (const file of files) {
  const rel = relative(projectRoot, file).replaceAll('\\', '/');
  const isSpec = rel.endsWith('.spec.ts');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    if (!isSpec) {
      for (const [pattern, label] of FORBIDDEN) {
        if (pattern.test(line)) violations.push(`${where} ${label}: ${line.trim()}`);
      }
      if (/\bfetch\s*\(/.test(line)) fetchSites.push(where);
    }
    for (const match of line.matchAll(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+)/g)) {
      if (!ALLOWED_HOSTS.has(match[1]) && !isSpec) violations.push(`${where} unapproved host ${match[1]}`);
    }
  });
}
notes.push(`fetch() call sites: ${fetchSites.length ? fetchSites.join(', ') : '(none)'}`);

// The front end must never talk to OpenAI or keep its tokens; the bridge may talk to OpenAI only.
for (const file of files) {
  const rel = relative(projectRoot, file).replaceAll('\\', '/');
  if (rel.endsWith('.spec.ts')) continue;
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (BRIDGE_ONLY.test(line)) violations.push(`${rel}:${i + 1} OpenAI host outside the ChatGPT bridge: ${line.trim()}`);
      if (/(access|refresh|id)_token/.test(line) && /(localStorage|sessionStorage|indexedDB|put\('meta')/.test(line)) violations.push(`${rel}:${i + 1} token stored in the browser: ${line.trim()}`);
    });
}
const bridgeSites = [];
for (const name of readdirSync(join(projectRoot, BRIDGE_DIR))) {
  if (!name.endsWith('.mjs') || name.endsWith('.test.mjs')) continue;
  const rel = `${BRIDGE_DIR}/${name}`;
  readFileSync(join(projectRoot, BRIDGE_DIR, name), 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const where = `${rel}:${i + 1}`;
      for (const [pattern, label] of FORBIDDEN) if (pattern.test(line)) violations.push(`${where} ${label}: ${line.trim()}`);
      for (const match of line.matchAll(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+)/g)) {
        if (!BRIDGE_HOSTS.has(match[1])) violations.push(`${where} unapproved bridge host ${match[1]}`);
      }
      if (/\bfetchFn\s*\(/.test(line)) bridgeSites.push(where);
      // CR-011: plan usage only — the bridge must never read or send a regular OpenAI API key, or use ChatGPT's backend-api.
      if (/OPENAI_API_KEY|OPENAI_KEY|backend-api|process\.env\.[A-Z_]*(API_?KEY|SECRET)/i.test(line)) violations.push(`${where} API key or backend-api use in the bridge: ${line.trim()}`);
      if (/console\.log\([^)]*(token|code_verifier|authorization)/i.test(line)) violations.push(`${where} secret may be logged: ${line.trim()}`);
    });
}
notes.push(`ChatGPT bridge outbound call sites: ${bridgeSites.join(', ') || '(none)'}`);

const lock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'));
const lockHosts = new Set(
  Object.values(lock.packages ?? {})
    .map((p) => p.resolved)
    .filter(Boolean)
    .map((u) => new URL(u).host),
);
notes.push(`package-lock resolved hosts: ${[...lockHosts].join(', ')}`);
if ([...lockHosts].some((h) => h !== 'registry.npmjs.org')) violations.push('package-lock has non-npmjs registry hosts');

// CR-010: the desktop shell's permissions follow the same approved-host list (nothing new, nothing broader),
// and the installed app must not depend on the dev server.
const TAURI_DIR = join(projectRoot, 'src-tauri');
try {
  const conf = JSON.parse(readFileSync(join(TAURI_DIR, 'tauri.conf.json'), 'utf8'));
  if (conf.build?.devUrl) violations.push(`src-tauri/tauri.conf.json build.devUrl is set (${conf.build.devUrl}); the installed app must not depend on a dev server`);
  if (!/^\.\.\/dist\//.test(conf.build?.frontendDist ?? '')) violations.push('src-tauri/tauri.conf.json frontendDist must be the local build output');
  if (/localhost:4200|127\.0\.0\.1:4200/.test(JSON.stringify(conf))) violations.push('src-tauri/tauri.conf.json mentions the dev server (localhost:4200)');
  const csp = String(conf.app?.security?.csp ?? '');
  const connect = /connect-src([^;]*)/.exec(csp)?.[1] ?? '';
  if (!csp) violations.push('src-tauri/tauri.conf.json has no CSP');
  if (/https?:\/\/(?!ipc\.localhost)/.test(connect) || /\*/.test(connect)) violations.push(`CSP connect-src allows hosts directly: ${connect.trim()}`);
  if (/unsafe-eval/.test(csp) || /script-src[^;]*unsafe-inline/.test(csp)) violations.push('CSP allows unsafe script execution');
  // Angular injects component styles as inline <style> elements, which a Tauri nonce on style-src would block (the
  // nonce makes browsers ignore 'unsafe-inline'). Only style-src may be exempt; scripts keep Tauri's nonce/hash protection.
  const exempt = conf.app?.security?.dangerousDisableAssetCspModification;
  if (exempt === true || (Array.isArray(exempt) && exempt.some((d) => d !== 'style-src'))) violations.push(`only style-src may be exempt from Tauri's CSP protection, got ${JSON.stringify(exempt)}`);
  const hostOf = (url) => new URL(url.replace('*', '1').replace(/\/\*$/, '/')).hostname;
  // CR-011: the Windows app has no Claude API and no Ollama, so neither api.anthropic.com nor localhost may be reachable from it.
  const FETCH_OK = new Set(['db.ygoprodeck.com', 'images.ygoprodeck.com', '127.0.0.1']);
  const OPEN_OK = new Set([...LINK_HOSTS, 'auth.openai.com']); // auth.openai.com: the sign-in page the bridge hands out
  let permissionCount = 0;
  for (const name of readdirSync(join(TAURI_DIR, 'capabilities'))) {
    const cap = JSON.parse(readFileSync(join(TAURI_DIR, 'capabilities', name), 'utf8'));
    for (const permission of cap.permissions ?? []) {
      permissionCount++;
      const id = typeof permission === 'string' ? permission : permission.identifier;
      if (/^(shell|process|updater|http:allow-fetch$)/.test(id) || /allow-execute|allow-spawn|allow-kill|global-scope/.test(id)) violations.push(`${name}: forbidden permission ${id}`);
      for (const rule of typeof permission === 'object' ? (permission.allow ?? []) : []) {
        if (rule.url) {
          const host = hostOf(rule.url);
          const ok = id.startsWith('http:') ? FETCH_OK.has(host) : id.startsWith('opener:') ? OPEN_OK.has(host) : false;
          if (!ok) violations.push(`${name}: ${id} allows unapproved host ${host}`);
          if (id.startsWith('opener:') && !rule.url.startsWith('https://')) violations.push(`${name}: ${id} allows a non-https link ${rule.url}`);
        }
        if (rule.path && !/^\$DOCUMENT\/YGO Combo 助手(\/backups(\/\*)?)?$/.test(rule.path)) violations.push(`${name}: ${id} allows files outside the backup folder: ${rule.path}`);
      }
    }
  }
  notes.push(`src-tauri: ${permissionCount} permission entries checked against the approved-host list; no dev-server dependency`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  notes.push('src-tauri: (not present)');
}

console.log(notes.join('\n'));
if (violations.length) {
  console.log(`\nVIOLATIONS (${violations.length}):\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('\nG11 audit: no violations');
