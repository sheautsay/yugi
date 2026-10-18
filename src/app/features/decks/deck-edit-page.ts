import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { CardImageService } from '../../core/card-image.service';
import { isDeckCard } from '../../core/card-search';
import { DECK_ZONES, ZONE_LABEL, banHints, checkDeck, countOf, deckCardIds } from '../../core/deck';
import { ComboRepository } from '../../core/combo-repository';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord, DeckRecord, DeckZone } from '../../core/models';
import { checkRoute } from '../../core/route-check';
import { toYdke } from '../../core/ydke';
import { CardDataPrompt } from '../../shared/card-data-prompt';
import { CardTile } from '../../shared/card-tile';
import { MissingCards } from '../../shared/missing-cards';
import { CardAdjust, CardBrowser } from './card-browser';
import { safeFileName, saveTextFile } from '../../shared/save-file';

@Component({
  selector: 'app-deck-edit-page',
  imports: [RouterLink, CardTile, CardBrowser, CardDataPrompt, MissingCards],
  templateUrl: './deck-edit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckEditPage {
  private readonly repo = inject(DeckRepository);
  private readonly cardData = inject(CardDataService);
  private readonly images = inject(CardImageService);
  private readonly combos = inject(ComboRepository);

  readonly deckId = input.required<string>();

  protected readonly zones = DECK_ZONES;
  protected readonly zoneLabel = ZONE_LABEL;
  protected readonly cardNames = inject(CardNamesService);

  protected readonly saved = signal<DeckRecord | null>(null);
  protected readonly draft = signal<DeckRecord | null>(null);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly notFound = signal(false);
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  /** When set, the card browser's +/− work on the side deck instead of main/extra. */
  protected readonly sideMode = signal(false);

  protected readonly check = computed(() => {
    const deck = this.draft();
    return deck ? checkDeck(deck, this.cards(), this.cardNames.nameLabel) : null;
  });
  protected readonly banHintList = computed(() => {
    const deck = this.draft();
    return deck ? banHints(deck, this.cards()) : [];
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

  /** Copies of a card across main, extra and side (the 3-copy rule). */
  protected copies(cardId: number): number {
    const deck = this.draft();
    return deck ? DECK_ZONES.reduce((sum, zone) => sum + countOf(deck[zone], cardId), 0) : 0;
  }

  /** G20: extra-deck monsters go to the extra deck, everything else to the main deck. */
  protected adjust({ card, delta }: CardAdjust): void {
    const zone: DeckZone = this.sideMode() ? 'side' : card.isExtraDeckType ? 'extra' : 'main';
    if (delta < 0) {
      if (countOf(this.draft()?.[zone] ?? [], card.cardId) === 0) return;
      this.changeCount(zone, card.cardId, -1);
      this.message.set(`已從${ZONE_LABEL[zone]}移除一張「${this.cardNames.labelOf(card.cardId, card)}」（尚未儲存）。`);
      return;
    }
    if (!isDeckCard(card)) {
      this.message.set(`「${this.cardNames.labelOf(card.cardId, card)}」是 Skill／Token 卡，不能放入牌組。`);
      return;
    }
    if (this.copies(card.cardId) >= 3) {
      this.message.set(`「${this.cardNames.labelOf(card.cardId, card)}」已有 3 張（同名卡最多 3 張）。`);
      return;
    }
    this.update((d) => {
      const rows = d[zone].some((c) => c.cardId === card.cardId)
        ? d[zone].map((c) => (c.cardId === card.cardId ? { ...c, count: c.count + 1 } : c))
        : [...d[zone], { cardId: card.cardId, count: 1 }];
      return { ...d, [zone]: rows };
    });
    this.remember(card);
    this.message.set(`已將「${this.cardNames.labelOf(card.cardId, card)}」加入${ZONE_LABEL[zone]}（尚未儲存）。`);
  }

  protected remember(card: CardRecord): void {
    this.cards.update((m) => new Map(m).set(card.cardId, card));
  }

  protected async save(): Promise<void> {
    const deck = this.draft();
    const saved = this.saved();
    if (!deck || !saved || !deck.name.trim()) return;
    const next: DeckRecord = { ...deck, name: deck.name.trim(), version: saved.version + 1, updatedAt: new Date().toISOString() };
    await this.repo.save(next);
    this.saved.set(next);
    this.draft.set(structuredClone(next));
    this.message.set(`已儲存（版本 ${next.version}）。符合的 Combo 會依新牌表重新計算。${await this.affectedAiRoutes(next)}`);
  }

  /** CR-004 G26-2: after a change, say how many of this deck's AI routes no longer fit. */
  private async affectedAiRoutes(deck: DeckRecord): Promise<string> {
    const routes = (await this.combos.list()).filter((c) => c.analysis?.deckId === deck.id);
    if (!routes.length) return '';
    const failing = routes.filter((r) => !checkRoute(r, deck, { cards: this.cards() }).passed).length;
    return failing
      ? `此牌組有 ${routes.length} 條 AI 路線，其中 ${failing} 條已不再通過資料驗證，請到「AI 展開分析」查看。`
      : `此牌組的 ${routes.length} 條 AI 路線仍通過資料驗證（牌組已變更，仍需重新確認）。`;
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
