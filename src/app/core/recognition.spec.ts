import { mulberry32 } from './hand';
import { HandRegion } from './models';
import {
  ART_BOX,
  RasterImage,
  artRegionVariants,
  gridFeatures,
  inset,
  recognizeHand,
  regionsFromRow,
  resolvedHand,
  screenshotFileError,
  screenshotSizeError,
  sortLeftToRight,
  within,
} from './recognition';

// SYNTHETIC images only: these tests check the algorithm and the G15a safety rules.
// They are not evidence for real Master Duel screenshot accuracy (G15b).

function blank(width: number, height: number, rgb: [number, number, number] = [0, 0, 0]): RasterImage & { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
}

/** Smooth random "artwork": bilinear-upsampled 6×6 colour blocks. */
function art(seed: number, size = 120): RasterImage {
  const rnd = mulberry32(seed);
  const blocks = Array.from({ length: 7 * 7 }, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
  const img = blank(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * 6;
      const fy = (y / size) * 6;
      const [ix, iy] = [Math.floor(fx), Math.floor(fy)];
      const [tx, ty] = [fx - ix, fy - iy];
      for (let c = 0; c < 3; c++) {
        const v00 = blocks[iy * 7 + ix][c];
        const v10 = blocks[iy * 7 + ix + 1][c];
        const v01 = blocks[(iy + 1) * 7 + ix][c];
        const v11 = blocks[(iy + 1) * 7 + ix + 1][c];
        img.data[(y * size + x) * 4 + c] = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
      }
    }
  }
  return img;
}

/** Area-average crop + resample — what the browser does with drawImage. */
function crop(img: RasterImage, r: HandRegion, w = 64, h = 64): RasterImage {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = (r.x + (r.w * x) / w) * img.width;
      const sx1 = (r.x + (r.w * (x + 1)) / w) * img.width;
      const sy0 = (r.y + (r.h * y) / h) * img.height;
      const sy1 = (r.y + (r.h * (y + 1)) / h) * img.height;
      const acc = [0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(sy0); yy < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); yy++) {
        for (let xx = Math.floor(sx0); xx < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); xx++) {
          const p = (Math.min(img.height - 1, yy) * img.width + Math.min(img.width - 1, xx)) * 4;
          acc[0] += img.data[p];
          acc[1] += img.data[p + 1];
          acc[2] += img.data[p + 2];
          n++;
        }
      }
      out.data.set([acc[0] / n, acc[1] / n, acc[2] / n, 255], (y * w + x) * 4);
    }
  }
  return out;
}

interface Look {
  brightness?: number;
  noise?: number;
  seed?: number;
}

/** A full card as rendered in a screenshot: coloured frame with the artwork in its window. */
function renderCard(artwork: RasterImage, look: Look = {}, width = 150, height = 219): RasterImage {
  const card = blank(width, height, [196, 120, 60]);
  const win = ART_BOX;
  const placed = crop(artwork, { x: 0, y: 0, w: 1, h: 1 }, Math.round(win.w * width), Math.round(win.h * height));
  const ox = Math.round(win.x * width);
  const oy = Math.round(win.y * height);
  const rnd = mulberry32(look.seed ?? 1);
  for (let y = 0; y < placed.height; y++) {
    for (let x = 0; x < placed.width; x++) {
      for (let c = 0; c < 3; c++) {
        const v = placed.data[(y * placed.width + x) * 4 + c] * (look.brightness ?? 1) + ((rnd() * 2 - 1) * (look.noise ?? 0));
        card.data[((oy + y) * width + ox + x) * 4 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }
  return card;
}

const DECK_IDS = Array.from({ length: 20 }, (_, i) => 1000 + i);
const ARTS = new Map(DECK_IDS.map((id) => [id, art(id)]));
const referenceOf = (artwork: RasterImage) => gridFeatures(crop(artwork, inset({ x: 0, y: 0, w: 1, h: 1 })));
const REFS = new Map(DECK_IDS.map((id) => [id, referenceOf(ARTS.get(id)!)]));
const COUNTS = new Map(DECK_IDS.map((id) => [id, 2]));

/** Features of a card boxed with a (possibly misaligned) box on the rendered card. */
function slotFeature(card: RasterImage, box: HandRegion = { x: 0, y: 0, w: 1, h: 1 }) {
  return artRegionVariants(box).map((r) => gridFeatures(crop(card, r)));
}

function recognize(cards: RasterImage[], options: { refs?: Map<number, Float32Array>; counts?: Map<number, number>; boxes?: HandRegion[] } = {}) {
  const boxes = options.boxes ?? cards.map(() => ({ x: 0, y: 0, w: 1, h: 1 }));
  return recognizeHand({
    regions: regionsFromRow({ x: 0, y: 0, w: 1, h: 1 }, cards.length),
    features: cards.map((c, i) => slotFeature(c, boxes[i])),
    references: options.refs ?? REFS,
    mainCounts: options.counts ?? COUNTS,
  });
}

describe('recognition — synthetic algorithm baseline', () => {
  it('recognises five distinct cards with confidence', () => {
    const hand = [1000, 1004, 1009, 1013, 1019];
    const { slots, missingReferences } = recognize(hand.map((id) => renderCard(ARTS.get(id)!)));
    expect(missingReferences).toEqual([]);
    expect(slots.map((s) => s.status)).toEqual(Array(5).fill('confident'));
    expect(slots.map((s) => s.chosenCardId)).toEqual(hand);
    expect(resolvedHand(slots)).toEqual(hand);
  });

  it('never reports a wrong card as confident across brightness, noise and box misalignment (synthetic)', () => {
    let confident = 0;
    let wrongConfident = 0;
    let correctTop1 = 0;
    let total = 0;
    for (const id of DECK_IDS) {
      for (const brightness of [0.75, 1, 1.2]) {
        for (const shift of [-0.03, 0, 0.03]) {
          const card = renderCard(ARTS.get(id)!, { brightness, noise: 12, seed: id });
          const box = { x: shift, y: shift, w: 1, h: 1 };
          const [slot] = recognize([card], { boxes: [box] }).slots;
          total++;
          if (slot.candidates[0]?.cardId === id) correctTop1++;
          if (slot.status === 'confident') {
            confident++;
            if (slot.chosenCardId !== id) wrongConfident++;
          }
        }
      }
    }
    expect(wrongConfident).toBe(0);
    expect(correctTop1 / total).toBeGreaterThanOrEqual(0.95);
    expect(confident / total).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  it('a card that is not in the deck is never confidently mistaken for a deck card', () => {
    for (let seed = 5000; seed < 5040; seed++) {
      const [slot] = recognize([renderCard(art(seed))]).slots;
      expect(slot.status).not.toBe('confident');
      expect(slot.chosenCardId).toBeUndefined();
    }
  });
});

describe('recognition — G15a safety rules', () => {
  it('candidates come only from main-deck cards, even if other references exist', () => {
    const extraId = 9999;
    const refs = new Map(REFS).set(extraId, referenceOf(art(extraId)));
    const { slots } = recognize([renderCard(art(extraId))], { refs });
    expect(slots[0].candidates.map((c) => c.cardId)).not.toContain(extraId);
    expect(slots[0].status).not.toBe('confident');
  });

  it('N10: two slots showing a card the deck holds once → best slot kept, the other becomes uncertain', () => {
    const counts = new Map(COUNTS).set(1003, 1);
    const cards = [renderCard(ARTS.get(1003)!, { brightness: 0.9, noise: 10, seed: 3 }), renderCard(ARTS.get(1003)!), renderCard(ARTS.get(1005)!)];
    const { slots } = recognize(cards, { counts });
    expect(slots[1]).toMatchObject({ status: 'confident', chosenCardId: 1003 });
    expect(slots[0].status).toBe('uncertain');
    expect(slots[0].chosenCardId).toBeUndefined();
    expect(slots[0].candidates[0].cardId).toBe(1003); // still offered as a suggestion
    expect(resolvedHand(slots)).toBeNull();
  });

  it('N10: when a main-deck card has no reference image nothing is confident', () => {
    const refs = new Map(REFS);
    refs.delete(1007);
    const { slots, missingReferences } = recognize([renderCard(ARTS.get(1000)!)], { refs });
    expect(missingReferences).toEqual([1007]);
    expect(slots[0].status).toBe('uncertain');
  });

  it('N10: without any reference image every slot is unrecognized', () => {
    const { slots } = recognize([renderCard(ARTS.get(1000)!), renderCard(ARTS.get(1001)!)], { refs: new Map() });
    expect(slots.map((s) => s.status)).toEqual(['unrecognized', 'unrecognized']);
    expect(slots.every((s) => s.candidates.length === 0)).toBe(true);
  });

  it('resolvedHand needs every slot confident or user-selected', () => {
    const { slots } = recognize([renderCard(ARTS.get(1000)!), renderCard(art(7777))]);
    expect(resolvedHand(slots)).toBeNull();
    slots[1] = { ...slots[1], chosenCardId: 1002, status: 'user-selected' };
    expect(resolvedHand(slots)).toEqual([1000, 1002]);
  });
});

describe('recognition — geometry and screenshot checks', () => {
  it('splits a whole-hand box into equal card boxes and sorts boxes left to right', () => {
    expect(regionsFromRow({ x: 0.1, y: 0.7, w: 0.5, h: 0.2 }, 5).map((r) => +r.x.toFixed(2))).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    const boxes = [
      { x: 0.5, y: 0, w: 0.1, h: 0.1 },
      { x: 0.1, y: 0, w: 0.1, h: 0.1 },
    ];
    expect(sortLeftToRight(boxes).map((b) => b.x)).toEqual([0.1, 0.5]);
  });

  it('maps the art window of a boxed card into image coordinates', () => {
    expect(within({ x: 0.5, y: 0.5, w: 0.2, h: 0.4 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toEqual({ x: 0.6, y: 0.7, w: 0.1, h: 0.2 });
  });

  it('N9: rejects unsupported types, oversize files and oversize dimensions', () => {
    expect(screenshotFileError({ type: 'image/png', size: 1000 })).toBeNull();
    expect(screenshotFileError({ type: 'image/webp', size: 20 * 1024 * 1024 })).toBeNull();
    expect(screenshotFileError({ type: 'application/pdf', size: 10, name: 'a.pdf' })).toContain('不是支援的圖片格式');
    expect(screenshotFileError({ type: 'image/gif', size: 10 })).toContain('PNG、JPEG、WebP');
    expect(screenshotFileError({ type: 'image/jpeg', size: 20 * 1024 * 1024 + 1 })).toContain('超過 20 MB');
    expect(screenshotSizeError(1920, 1080)).toBeNull();
    expect(screenshotSizeError(8193, 100)).toContain('超過上限');
    expect(screenshotSizeError(0, 0)).toContain('沒有內容');
  });
});
