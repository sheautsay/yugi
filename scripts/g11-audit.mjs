// G11 audit: no git remote, no unapproved network endpoints, no game/screen/credential access.
// Usage: node scripts/g11-audit.mjs   (exit code 1 on any violation)
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const decode = (p) => decodeURIComponent(p);
const projectRoot = decode(root);

// Hosts the app may contact (spec §2 card data source) or merely link to (F09 source URL whitelist).
const FETCH_HOSTS = ['db.ygoprodeck.com', 'images.ygoprodeck.com'];
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
];
const ALLOWED_HOSTS = new Set([...FETCH_HOSTS, ...LINK_HOSTS, 'localhost']);

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

const lock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'));
const lockHosts = new Set(
  Object.values(lock.packages ?? {})
    .map((p) => p.resolved)
    .filter(Boolean)
    .map((u) => new URL(u).host),
);
notes.push(`package-lock resolved hosts: ${[...lockHosts].join(', ')}`);
if ([...lockHosts].some((h) => h !== 'registry.npmjs.org')) violations.push('package-lock has non-npmjs registry hosts');

console.log(notes.join('\n'));
if (violations.length) {
  console.log(`\nVIOLATIONS (${violations.length}):\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('\nG11 audit: no violations');
