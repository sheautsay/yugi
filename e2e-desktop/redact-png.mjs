// Covers a rectangle of a PNG with a solid box (local headless Chromium canvas). Usage: node redact.mjs <in> <out> x y w h [cropOut]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output, x, y, w, h, cropOut] = process.argv.slice(2);
const b64 = readFileSync(input).toString('base64');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ b64, x, y, w, h }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.fillStyle = '#1b2540';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#e9eef8';
    g.font = '16px sans-serif';
    g.fillText('<email redacted>', x + 8, y + h / 2 + 6);
    const crop = document.createElement('canvas');
    crop.width = 900;
    crop.height = 260;
    crop.getContext('2d').drawImage(c, Math.max(0, x - 200), Math.max(0, y - 100), 900, 260, 0, 0, 900, 260);
    return { full: c.toDataURL('image/png').split(',')[1], crop: crop.toDataURL('image/png').split(',')[1] };
  },
  { b64, x: +x, y: +y, w: +w, h: +h },
);
writeFileSync(output, Buffer.from(result.full, 'base64'));
if (cropOut) writeFileSync(cropOut, Buffer.from(result.crop, 'base64'));
await browser.close();
