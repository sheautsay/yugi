import { Injectable, inject } from '@angular/core';
import { CardImageService } from '../../core/card-image.service';
import { HandRegion } from '../../core/models';
import { RasterImage, artRegionVariants, gridFeatures, inset, recognizeHand } from '../../core/recognition';

const SAMPLE = 64;

/** Draws `region` (relative coordinates) of `source` into a SAMPLE×SAMPLE raster. */
export function rasterize(source: ImageBitmap, region: HandRegion, size = SAMPLE): RasterImage {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, region.x * source.width, region.y * source.height, region.w * source.width, region.h * source.height, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/** In-memory preview of one boxed card; never stored. */
export function thumbnail(source: ImageBitmap, region: HandRegion, width = 64): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((width * region.h * source.height) / (region.w * source.width)));
  canvas.getContext('2d')!.drawImage(source, region.x * source.width, region.y * source.height, region.w * source.width, region.h * source.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Browser side of rev1 R7: reference features from cached card art + per-slot features. */
@Injectable({ providedIn: 'root' })
export class HandRecognitionService {
  private readonly images = inject(CardImageService);
  private readonly cache = new Map<number, Float32Array>();
  private cacheVersion = -1;

  missingReferences(cardIds: Iterable<number>): Promise<number[]> {
    return this.images.missing(cardIds, 'cropped');
  }

  /** Explicit user action: downloads reference art through the same throttled card-image path. */
  downloadReferences(cardIds: Iterable<number>) {
    return this.images.download(cardIds, 'cropped');
  }

  async recognize(screenshot: ImageBitmap, regions: readonly HandRegion[], mainCounts: ReadonlyMap<number, number>) {
    const references = await this.references([...mainCounts.keys()]);
    const features = regions.map((card) => artRegionVariants(card).map((window) => gridFeatures(rasterize(screenshot, window))));
    return recognizeHand({ regions, features, references, mainCounts });
  }

  private async references(cardIds: number[]): Promise<Map<number, Float32Array>> {
    if (this.cacheVersion !== this.images.version()) {
      this.cache.clear();
      this.cacheVersion = this.images.version();
    }
    const refs = new Map<number, Float32Array>();
    for (const id of cardIds) {
      let feature = this.cache.get(id);
      if (!feature) {
        const blob = await this.images.blob(id, 'cropped');
        if (!blob) continue;
        const bitmap = await createImageBitmap(blob);
        feature = gridFeatures(rasterize(bitmap, inset({ x: 0, y: 0, w: 1, h: 1 })));
        bitmap.close();
        this.cache.set(id, feature);
      }
      refs.set(id, feature);
    }
    return refs;
  }
}
