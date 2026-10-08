import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CardImageService } from '../core/card-image.service';
import { SettingsService } from '../core/settings.service';
import { displayName } from '../core/deck';
import { CardRecord } from '../core/models';

/**
 * Card image from the local cache, or a readable frame with name and ID when there is none.
 * A missing thumbnail is requested only while the tile is on screen (G19).
 */
@Component({
  selector: 'app-card-tile',
  template: `
    <figure class="tile" [class.small]="size() === 's'" [attr.aria-label]="label()">
      @if (src(); as url) {
        <img [src]="url" [alt]="label()" (error)="onImageError()" />
      } @else {
        <div class="fallback" aria-hidden="true">
          <span class="name">{{ name() }}</span>
          <span class="id">ID {{ cardId() }}</span>
        </div>
      }
      @if (count() > 1) {
        <span class="count" aria-hidden="true">×{{ count() }}</span>
      }
      @if (caption()) {
        <figcaption>{{ name() }}</figcaption>
      }
    </figure>
  `,
  styles: `
    .tile { position: relative; margin: 0; width: 96px; }
    .tile.small { width: 64px; }
    img, .fallback { display: block; width: 100%; aspect-ratio: 59 / 86; border-radius: 4px; object-fit: cover; }
    .fallback { border: 2px solid #8a93a3; background: #eef0f4; padding: 4px; display: flex; flex-direction: column; justify-content: space-between; font-size: 0.7rem; line-height: 1.25; overflow: hidden; }
    .small .fallback { font-size: 0.6rem; }
    .name { overflow-wrap: anywhere; }
    .id { color: #5b6270; }
    .count { position: absolute; top: 2px; right: 2px; background: #16263f; color: #fff; border-radius: 999px; padding: 0 6px; font-size: 0.8rem; font-weight: 700; }
    figcaption { font-size: 0.75rem; line-height: 1.3; margin-top: 2px; overflow-wrap: anywhere; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardTile {
  private readonly images = inject(CardImageService);
  private readonly settings = inject(SettingsService);

  readonly cardId = input.required<number>();
  readonly card = input<CardRecord | undefined>();
  readonly count = input(1);
  readonly size = input<'s' | 'm'>('m');
  readonly caption = input(false);

  protected readonly src = signal<string | null>(null);
  /** The cache lookup for the current card has finished. */
  private readonly looked = signal(false);
  private readonly visible = signal(false);
  /** The cached image could not be decoded; show the frame and stop requesting it. */
  private readonly broken = signal(false);
  protected readonly name = computed(() => displayName(this.card()));
  protected readonly label = computed(() => `${this.name()}（ID ${this.cardId()}）${this.count() > 1 ? `×${this.count()}` : ''}`);

  constructor() {
    // A different card (or a bulk cache change): look it up afresh.
    effect((onCleanup) => {
      const id = this.cardId();
      this.images.version();
      this.src.set(null);
      this.looked.set(false);
      this.broken.set(false);
      this.lookup(id, onCleanup);
    });

    // An image was just stored: only the tiles showing that card look again.
    effect((onCleanup) => {
      const loaded = this.images.loaded();
      const id = untracked(this.cardId);
      if (loaded?.variant === 'small' && loaded.cardId === id) this.lookup(id, onCleanup);
    });

    effect((onCleanup) => {
      const id = this.cardId();
      if (!this.visible() || !this.looked() || this.src() || this.broken() || !this.settings.settings().autoThumbnails) return;
      this.images.want(id);
      onCleanup(() => this.images.unwant(id));
    });

    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver((entries) => this.visible.set(entries.some((e) => e.isIntersecting)), { rootMargin: '120px' });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected onImageError(): void {
    this.broken.set(true);
    this.src.set(null);
  }

  private lookup(id: number, onCleanup: (fn: () => void) => void): void {
    let cancelled = false;
    onCleanup(() => (cancelled = true));
    this.images.cachedUrl(id).then(
      (url) => {
        if (cancelled || this.broken()) return;
        this.src.set(url);
        this.looked.set(true);
      },
      () => !cancelled && this.looked.set(true),
    );
  }
}
