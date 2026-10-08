import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { CardImageService } from '../../core/card-image.service';
import { DECK_ZONES, ZONE_LABEL, checkDeck, deckCardIds, displayName } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord, DeckRecord, DeckZone } from '../../core/models';
import { toYdke } from '../../core/ydke';
import { CardSearch } from '../../shared/card-search';
import { CardTile } from '../../shared/card-tile';
import { safeFileName, saveTextFile } from '../../shared/save-file';

@Component({
  selector: 'app-deck-edit-page',
  imports: [RouterLink, CardTile, CardSearch],
  templateUrl: './deck-edit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckEditPage {
  private readonly repo = inject(DeckRepository);
  private readonly cardData = inject(CardDataService);
  private readonly images = inject(CardImageService);

  readonly deckId = input.required<string>();

  protected readonly zones = DECK_ZONES;
  protected readonly zoneLabel = ZONE_LABEL;
  protected readonly displayName = displayName;

  protected readonly saved = signal<DeckRecord | null>(null);
  protected readonly draft = signal<DeckRecord | null>(null);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly notFound = signal(false);
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly addZone = signal<DeckZone>('main');

  protected readonly check = computed(() => {
    const deck = this.draft();
    return deck ? checkDeck(deck, this.cards()) : null;
  });
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  protected readonly ydke = computed(() => {
    const deck = this.draft();
    return deck ? toYdke(deck) : '';
  });

  constructor() {
    effect(() => void this.load(this.deckId()));
    effect(() => {
      this.cardData.version();
      void this.refreshCards();
    });
  }

  private async load(id: string): Promise<void> {
    const deck = await this.repo.get(id);
    this.notFound.set(!deck);
    this.saved.set(deck ?? null);
    this.draft.set(deck ? structuredClone(deck) : null);
    await this.refreshCards();
  }

  private async refreshCards(): Promise<void> {
    const deck = this.draft();
    if (deck) this.cards.set(await this.cardData.getMany(deckCardIds(deck)));
  }

  protected rename(name: string): void {
    this.update((d) => ({ ...d, name }));
  }

  protected changeCount(zone: DeckZone, cardId: number, delta: number): void {
    this.update((d) => ({
      ...d,
      [zone]: d[zone].map((c) => (c.cardId === cardId ? { ...c, count: c.count + delta } : c)).filter((c) => c.count > 0),
    }));
  }

  protected removeCard(zone: DeckZone, cardId: number): void {
    this.update((d) => ({ ...d, [zone]: d[zone].filter((c) => c.cardId !== cardId) }));
  }

  protected addCard(card: CardRecord): void {
    const zone = this.addZone();
    this.update((d) => {
      const existing = d[zone].find((c) => c.cardId === card.cardId);
      const rows = existing
        ? d[zone].map((c) => (c.cardId === card.cardId ? { ...c, count: Math.min(3, c.count + 1) } : c))
        : [...d[zone], { cardId: card.cardId, count: 1 }];
      return { ...d, [zone]: rows };
    });
    this.cards.update((m) => new Map(m).set(card.cardId, card));
    this.message.set(`已將「${card.nameEn}」加入${ZONE_LABEL[zone]}（尚未儲存）。`);
  }

  protected async save(): Promise<void> {
    const deck = this.draft();
    const saved = this.saved();
    if (!deck || !saved || !deck.name.trim()) return;
    const next: DeckRecord = { ...deck, name: deck.name.trim(), version: saved.version + 1, updatedAt: new Date().toISOString() };
    await this.repo.save(next);
    this.saved.set(next);
    this.draft.set(structuredClone(next));
    this.message.set(`已儲存（版本 ${next.version}）。符合的 Combo 會依新牌表重新計算。`);
  }

  protected discard(): void {
    const saved = this.saved();
    if (saved) this.draft.set(structuredClone(saved));
    this.message.set('已放棄未儲存的變更。');
  }

  protected async downloadCardData(): Promise<void> {
    const check = this.check();
    if (!check) return;
    this.busy.set(true);
    this.message.set('正在下載卡片資料…');
    const result = await this.cardData.downloadMissing(check.unresolvedIds);
    this.busy.set(false);
    this.message.set(
      result.error ?? (result.unknownIds.length ? `資料來源查無 ID：${result.unknownIds.join('、')}` : `已下載 ${result.added} 張卡片資料。`),
    );
  }

  protected async downloadImages(): Promise<void> {
    const deck = this.draft();
    if (!deck) return;
    this.busy.set(true);
    const pending = (await this.images.missing(deckCardIds(deck))).length;
    this.message.set(`正在下載 ${pending} 張卡圖（為遵守來源限制會逐張下載，約需 ${Math.ceil(pending / 4)} 秒）…`);
    const result = await this.images.download(deckCardIds(deck));
    this.busy.set(false);
    this.message.set(
      result.failed.length ? `已下載 ${result.downloaded} 張卡圖；${result.failed.length} 張失敗：${result.error}` : `已下載 ${result.downloaded} 張卡圖（已快取者略過）。`,
    );
  }

  protected exportJson(): void {
    const deck = this.saved();
    if (deck) saveTextFile(`${safeFileName(deck.name)}.deck.json`, JSON.stringify(deck, null, 2));
  }

  protected async copyYdke(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.ydke());
      this.message.set('已複製 ydke:// 代碼。');
    } catch {
      this.message.set('無法存取剪貼簿，請手動選取下方代碼複製。');
    }
  }

  private update(fn: (deck: DeckRecord) => DeckRecord): void {
    const deck = this.draft();
    if (deck) this.draft.set(fn(deck));
  }
}
