import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CardImageService } from '../core/card-image.service';
import { displayName } from '../core/deck';
import { CardRecord } from '../core/models';

/** Card image from the local cache, or a readable frame with name and ID when there is none. */
@Component({
  selector: 'app-card-tile',
  template: `
    <figure class="tile" [class.small]="size() === 's'" [attr.aria-label]="label()">
      @if (src(); as url) {
        <img [src]="url" [alt]="label()" (error)="src.set(null)" />
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

  readonly cardId = input.required<number>();
  readonly card = input<CardRecord | undefined>();
  readonly count = input(1);
  readonly size = input<'s' | 'm'>('m');
  readonly caption = input(false);

  protected readonly src = signal<string | null>(null);
  protected readonly name = computed(() => displayName(this.card()));
  protected readonly label = computed(() => `${this.name()}（ID ${this.cardId()}）${this.count() > 1 ? `×${this.count()}` : ''}`);

  constructor() {
    effect((onCleanup) => {
      const id = this.cardId();
      this.images.version();
      let cancelled = false;
      onCleanup(() => (cancelled = true));
      this.images.cachedUrl(id).then(
        (url) => !cancelled && this.src.set(url),
        () => !cancelled && this.src.set(null),
      );
    });
  }
}
