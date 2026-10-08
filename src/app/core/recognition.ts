import { HandRecognitionSlot, HandRegion, RecognitionStatus } from './models';

// rev1 R7: local, deck-restricted card-art comparison. No AI, no network for the screenshot.
// Thresholds are provisional (set from synthetic tests); G15b recalibrates them on real screenshots.

/** RGBA pixels, row-major. */
export interface RasterImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export const GRID = 16;

/** Artwork window inside a full card (standard non-pendulum frame), relative to the card box. */
export const ART_BOX: HandRegion = { x: 0.12, y: 0.185, w: 0.76, h: 0.52 };

/** Trim applied to both the screenshot art and the reference art so frame edges never count. */
export const ART_INSET = 0.05;

export const THRESHOLDS = {
  /** Best score needed for "confident". */
  confident: 0.8,
  /** Lead over the second candidate needed for "confident". */
  margin: 0.1,
  /** Below this the slot is "unrecognized". */
  minimum: 0.45,
};

export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
export const MAX_SCREENSHOT_SIDE = 8192;

export function screenshotFileError(file: { type: string; size: number; name?: string }): string | null {
  if (!SCREENSHOT_TYPES.includes(file.type)) return `「${file.name ?? '檔案'}」不是支援的圖片格式（只支援 PNG、JPEG、WebP）。`;
  if (file.size > MAX_SCREENSHOT_BYTES) return `圖片超過 20 MB（${(file.size / 1024 / 1024).toFixed(1)} MB），請改用較小的截圖。`;
  return null;
}

export function screenshotSizeError(width: number, height: number): string | null {
  if (width > MAX_SCREENSHOT_SIDE || height > MAX_SCREENSHOT_SIDE) return `圖片尺寸 ${width}×${height} 超過上限 ${MAX_SCREENSHOT_SIDE} px，請改用較小的截圖。`;
  if (width < 1 || height < 1) return '圖片沒有內容。';
  return null;
}

/** Sub-rectangle `inner` (relative to `outer`) expressed relative to the whole image. */
export function within(outer: HandRegion, inner: HandRegion): HandRegion {
  return { x: outer.x + inner.x * outer.w, y: outer.y + inner.y * outer.h, w: inner.w * outer.w, h: inner.h * outer.h };
}

export function inset(r: HandRegion, fraction = ART_INSET): HandRegion {
  return { x: r.x + r.w * fraction, y: r.y + r.h * fraction, w: r.w * (1 - 2 * fraction), h: r.h * (1 - 2 * fraction) };
}

/** Art area to sample for a card boxed on the screenshot. */
export function artRegion(card: HandRegion): HandRegion {
  return inset(within(card, ART_BOX));
}

/** Shifts (fraction of the card box) tried for every slot, so imprecise boxes still match. */
export const JITTER = [-0.04, 0, 0.04];

export function artRegionVariants(card: HandRegion): HandRegion[] {
  const base = artRegion(card);
  return JITTER.flatMap((dy) => JITTER.map((dx) => ({ ...base, x: base.x + dx * card.w, y: base.y + dy * card.h })));
}

/** Splits one box drawn around the whole hand into `n` equal card boxes, left to right. */
export function regionsFromRow(row: HandRegion, n: number): HandRegion[] {
  return Array.from({ length: n }, (_, i) => ({ x: row.x + (row.w / n) * i, y: row.y, w: row.w / n, h: row.h }));
}

export function sortLeftToRight(regions: readonly HandRegion[]): HandRegion[] {
  return [...regions].sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
}

/**
 * Area-averaged GRID×GRID RGB grid, z-normalised per channel so overall brightness and contrast
 * differences between the game render and the reference image cancel out.
 */
export function gridFeatures(img: RasterImage, grid = GRID): Float32Array {
  const out = new Float32Array(grid * grid * 3);
  for (let gy = 0; gy < grid; gy++) {
    const y0 = Math.floor((gy * img.height) / grid);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * img.height) / grid));
    for (let gx = 0; gx < grid; gx++) {
      const x0 = Math.floor((gx * img.width) / grid);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * img.width) / grid));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * img.width + x) * 4;
          r += img.data[p];
          g += img.data[p + 1];
          b += img.data[p + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (gy * grid + gx) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  for (let c = 0; c < 3; c++) {
    let mean = 0;
    for (let i = c; i < out.length; i += 3) mean += out[i];
    mean /= grid * grid;
    let variance = 0;
    for (let i = c; i < out.length; i += 3) variance += (out[i] - mean) ** 2;
    const sd = Math.sqrt(variance / (grid * grid)) || 1;
    for (let i = c; i < out.length; i += 3) out[i] = (out[i] - mean) / sd;
  }
  return out;
}

/** Pearson correlation of two normalised feature vectors, in [-1, 1]. */
export function similarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum / a.length;
}

/** Score per candidate = best similarity over the slot's shifted art windows. */
export function rankCandidates(variants: readonly Float32Array[], references: ReadonlyMap<number, Float32Array>, limit = 3): Array<{ cardId: number; score: number }> {
  return [...references]
    .map(([cardId, ref]) => ({ cardId, score: Math.max(...variants.map((v) => similarity(v, ref))) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function classify(candidates: ReadonlyArray<{ score: number }>, thresholds = THRESHOLDS): RecognitionStatus {
  const [best, second] = candidates;
  if (!best || best.score < thresholds.minimum) return 'unrecognized';
  if (best.score >= thresholds.confident && best.score - (second?.score ?? -1) >= thresholds.margin) return 'confident';
  return 'uncertain';
}

export interface RecognitionInput {
  regions: readonly HandRegion[];
  /** Per region: features of each window from {@link artRegionVariants}. */
  features: ReadonlyArray<readonly Float32Array[]>;
  /** Reference features for main-deck cards that have a cached reference image. */
  references: ReadonlyMap<number, Float32Array>;
  /** Main-deck copies per card ID — the only possible answers. */
  mainCounts: ReadonlyMap<number, number>;
  thresholds?: typeof THRESHOLDS;
}

/**
 * G15a: candidates come only from the main deck; when any main-deck card lacks a reference image
 * nothing can be "confident"; a card picked for more slots than the deck holds keeps only its
 * best-scoring slots and the rest become "uncertain" (never silently switched to another card).
 */
export function recognizeHand(input: RecognitionInput): { slots: HandRecognitionSlot[]; missingReferences: number[] } {
  const references = new Map([...input.references].filter(([id]) => (input.mainCounts.get(id) ?? 0) > 0));
  const missingReferences = [...input.mainCounts.keys()].filter((id) => !references.has(id));

  const slots: HandRecognitionSlot[] = input.regions.map((region, index) => {
    if (references.size === 0) return { index, region, candidates: [], status: 'unrecognized' };
    const candidates = rankCandidates(input.features[index], references);
    let status = classify(candidates, input.thresholds);
    if (status === 'confident' && missingReferences.length) status = 'uncertain';
    return { index, region, candidates, status, ...(status === 'confident' ? { chosenCardId: candidates[0].cardId } : {}) };
  });

  const byCard = new Map<number, HandRecognitionSlot[]>();
  for (const slot of slots) {
    if (slot.chosenCardId !== undefined) byCard.set(slot.chosenCardId, [...(byCard.get(slot.chosenCardId) ?? []), slot]);
  }
  for (const [cardId, picked] of byCard) {
    const allowed = input.mainCounts.get(cardId) ?? 0;
    picked
      .sort((a, b) => b.candidates[0].score - a.candidates[0].score)
      .slice(allowed)
      .forEach((slot) => {
        slot.status = 'uncertain';
        delete slot.chosenCardId;
      });
  }
  return { slots, missingReferences };
}

/** The confirmed hand, or null while any slot is unresolved. */
export function resolvedHand(slots: readonly HandRecognitionSlot[]): number[] | null {
  if (slots.some((s) => s.chosenCardId === undefined || (s.status !== 'confident' && s.status !== 'user-selected'))) return null;
  return slots.map((s) => s.chosenCardId!);
}
