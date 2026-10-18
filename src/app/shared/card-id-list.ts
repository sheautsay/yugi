import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CardNamesService } from '../core/card-names.service';
import { CardCount, CardRecord } from '../core/models';
import { CardSearch } from './card-search';

/**
 * Editable list of cards picked through the card search. Bind `ids` for a plain ID list, or
 * `counts` for card + count rows.
 */
@Component({
  selector: 'app-card-id-list',
  imports: [CardSearch],
  template: `
    <div class="stack">
      <span class="field-label">{{ label() }}</span>
      @if (rows().length === 0) {
        <span class="muted">（未填）</span>
      }
      <ul class="plain chips">
        @for (row of rows(); track row.cardId) {
          <li class="chip">
            <span>{{ name(row.cardId) }} <span class="muted">ID {{ row.cardId }}</span></span>
            @if (counts()) {
              <label class="inline">
                張數
                <input type="number" min="1" max="3" [value]="row.count" (input)="setCount(row.cardId, $any($event.target).value)" />
              </label>
            }
            <button type="button" (click)="remove(row.cardId)" [attr.aria-label]="'移除 ' + name(row.cardId)">✕</button>
          </li>
        }
      </ul>
      @if (searching()) {
        <app-card-search [label]="'搜尋要加入「' + label() + '」的卡'" actionLabel="加入" (picked)="add($event)" />
        <button type="button" (click)="searching.set(false)">完成</button>
      } @else {
        <button type="button" (click)="searching.set(true)" [attr.aria-label]="'加入卡片到「' + label() + '」'">＋ 加入卡片</button>
      }
    </div>
  `,
  styles: `
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 999px; padding: 2px 4px 2px 10px; background: var(--surface-2); }
    .chip button { min-height: 32px; padding: 2px 8px; }
    .inline { flex-direction: row; align-items: center; gap: 4px; }
    .inline input { width: 4em; }
    .field-label { font-weight: 600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardIdList {
  private readonly cardNames = inject(CardNamesService);

  readonly label = input.required<string>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly ids = input<readonly number[] | undefined>(undefined);
  readonly counts = input<readonly CardCount[] | undefined>(undefined);
  readonly idsChange = output<number[]>();
  readonly countsChange = output<CardCount[]>();
  readonly picked = output<CardRecord>();

  protected readonly searching = signal(false);
  protected readonly rows = computed<readonly CardCount[]>(() => this.counts() ?? (this.ids() ?? []).map((cardId) => ({ cardId, count: 1 })));

  protected name(cardId: number): string {
    return this.cardNames.labelOf(cardId, this.cards().get(cardId));
  }

  protected add(card: CardRecord): void {
    this.picked.emit(card);
    if (this.rows().some((r) => r.cardId === card.cardId)) return;
    this.emit([...this.rows(), { cardId: card.cardId, count: 1 }]);
  }

  protected remove(cardId: number): void {
    this.emit(this.rows().filter((r) => r.cardId !== cardId));
  }

  protected setCount(cardId: number, value: string): void {
    const count = Math.max(1, Math.min(3, Math.trunc(Number(value)) || 1));
    this.emit(this.rows().map((r) => (r.cardId === cardId ? { ...r, count } : r)));
  }

  private emit(rows: CardCount[]): void {
    if (this.counts()) this.countsChange.emit(rows);
    else this.idsChange.emit(rows.map((r) => r.cardId));
  }
}
