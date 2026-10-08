import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CardDataService } from '../core/card-data.service';
import { CardRecord } from '../core/models';
import { CardTile } from './card-tile';

/** Search cached cards by name or passcode; online search is an explicit, separate action. */
@Component({
  selector: 'app-card-search',
  imports: [CardTile],
  template: `
    <form class="row" (submit)="$event.preventDefault(); searchLocal()">
      <label>
        {{ label() }}
        <input [value]="query()" (input)="query.set($any($event.target).value)" placeholder="卡名（英文）或卡片 ID" />
      </label>
      <button type="submit">搜尋</button>
      @if (allowOnline()) {
        <button type="button" (click)="searchOnline()" [disabled]="busy()">線上搜尋（YGOPRODeck）</button>
      }
    </form>
    @if (message()) {
      <p class="notice" role="status">{{ message() }}</p>
    }
    @if (results().length) {
      <ul class="plain results">
        @for (card of results(); track card.cardId) {
          <li class="row">
            <app-card-tile [cardId]="card.cardId" [card]="card" size="s" />
            <span class="grow">{{ card.nameEn }} <span class="muted">（ID {{ card.cardId }}）</span></span>
            <button type="button" (click)="picked.emit(card)">{{ actionLabel() }}</button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .results { max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .grow { flex: 1 1 160px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardSearch {
  private readonly cards = inject(CardDataService);

  readonly label = input('搜尋卡片');
  readonly actionLabel = input('選擇');
  readonly allowOnline = input(true);
  /** When set, only these card IDs can be found (e.g. the current deck's main deck). */
  readonly restrictTo = input<readonly number[] | undefined>(undefined);
  readonly picked = output<CardRecord>();

  protected readonly query = signal('');
  protected readonly results = signal<CardRecord[]>([]);
  protected readonly message = signal('');
  protected readonly busy = signal(false);

  protected async searchLocal(): Promise<void> {
    const found = this.restrict(await this.cards.search(this.query()));
    this.results.set(found);
    this.message.set(found.length ? '' : '本機快取中找不到符合的卡片。可改用線上搜尋，或先在牌組頁下載卡片資料。');
  }

  protected async searchOnline(): Promise<void> {
    this.busy.set(true);
    const { cards, error } = await this.cards.searchOnline(this.query());
    this.busy.set(false);
    const found = this.restrict(cards);
    this.results.set(found);
    this.message.set(error ?? (found.length ? '' : '線上也找不到符合的卡片，請改用英文卡名或卡片 ID。'));
  }

  private restrict(cards: CardRecord[]): CardRecord[] {
    const allowed = this.restrictTo();
    return allowed ? cards.filter((c) => allowed.includes(c.cardId)) : cards;
  }
}
