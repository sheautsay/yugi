// Draws the app icon source (1024x1024 PNG) with no image library: a rounded purple tile holding a gold-edged card
// with a diamond. `npx tauri icon scripts/desktop/icon-source.png` then produces every size and the .ico.
// Usage: node scripts/desktop/make-icon.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 1024;
const here = dirname(fileURLToPath(import.meta.url));

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function pixel(x, y) {
  // Supersample 3x3 for smooth edges.
  let r = 0, g = 0, b = 0, a = 0;
  const S = 3;
  for (let sy = 0; sy < S; sy++) {
    for (let sx = 0; sx < S; sx++) {
      const px = x + (sx + 0.5) / S, py = y + (sy + 0.5) / S;
      let c = null;
      if (inRoundRect(px, py, 40, 40, N - 40, N - 40, 200)) {
        c = [...mix([38, 22, 84], [112, 48, 150], py / N), 255];
        if (inRoundRect(px, py, 290, 170, 734, 854, 46)) {
          c = [...mix([255, 214, 102], [214, 152, 40], py / N), 255]; // gold edge
          if (inRoundRect(px, py, 322, 202, 702, 822, 28)) {
            c = [...mix([250, 246, 236], [226, 214, 196], py / N), 255]; // card face
            const d = Math.abs(px - 512) + Math.abs(py - 470);
            if (d < 170) c = [...mix([112, 48, 150], [60, 26, 110], (py - 300) / 340), 255]; // diamond
            if (d < 170 && d > 140) c = [214, 152, 40, 255];
            if (inRoundRect(px, py, 372, 690, 652, 760, 20)) c = [112, 48, 150, 255]; // text bar
          }
        }
      }
      if (c) {
        r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
      }
    }
  }
  const total = S * S;
  return a === 0 ? [0, 0, 0, 0] : [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / total)];
}

const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const [r, g, b, a] = pixel(x, y);
    const o = y * (N * 4 + 1) + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(join(here, 'icon-source.png'), png);
console.log(`icon-source.png ${png.length} bytes`);
