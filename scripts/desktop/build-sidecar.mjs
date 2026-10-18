// Builds the ChatGPT bridge into ONE standalone Windows executable that carries its own Node runtime
// (Node "single executable application"), so the installed app needs no Node.js on the user's computer (CR-010, D3/D10).
//
// Usage: node scripts/desktop/build-sidecar.mjs
// Output: src-tauri/binaries/ygo-bridge-x86_64-pc-windows-msvc.exe (the name Tauri's `externalBin` expects) and a
//         build report with sizes and SHA-256 next to it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = join(root, 'build', 'sidecar');
const outDir = join(root, 'src-tauri', 'binaries');
const triple = 'x86_64-pc-windows-msvc';
const exeName = `ygo-bridge-${triple}.exe`;
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('The Windows x64 sidecar must be built on Windows x64');

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(outDir, { recursive: true });

// 1. One CommonJS file with no external imports (only node: built-ins remain).
const bundle = join(work, 'bridge.cjs');
await build({
  entryPoints: [join(root, 'scripts', 'chatgpt-bridge', 'main.mjs')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  legalComments: 'none',
  logLevel: 'warning',
});

// 2. The SEA blob.
const config = join(work, 'sea-config.json');
writeFileSync(config, JSON.stringify({ main: bundle, output: join(work, 'sea-prep.blob'), disableExperimentalSEAWarning: true, useCodeCache: false }));
execFileSync(process.execPath, ['--experimental-sea-config', config], { stdio: 'inherit' });

// 3. Copy this machine's Node and inject the blob.
const exe = join(work, exeName);
copyFileSync(process.execPath, exe);
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');
execFileSync(process.execPath, [postject, exe, 'NODE_SEA_BLOB', join(work, 'sea-prep.blob'), '--sentinel-fuse', SEA_FUSE], { stdio: 'inherit' });

copyFileSync(exe, join(outDir, exeName));
const sha = createHash('sha256').update(readFileSync(exe)).digest('hex');
const report = { file: exeName, bytes: statSync(exe).size, sha256: sha, node: process.version, builtAt: new Date().toISOString() };
writeFileSync(join(outDir, `${exeName}.build.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
