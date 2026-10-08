import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CardDataService } from '../../core/card-data.service';
import { DECK_ZONES, DeckCheck, ParseIssue, ParsedDeck, ZONE_LABEL, checkDeck, deckCardIds, newDeck } from '../../core/deck';
import { DeckTextFormat, parseDeckText } from '../../core/deck-import';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord, DeckRecord } from '../../core/models';
import { MAX_YDK_LENGTH } from '../../core/ydk';
import { CardTile } from '../../shared/card-tile';

interface Preview {
  format: Exclude<DeckTextFormat, 'unknown'>;
  deck: ParsedDeck;
  cards: Map<number, CardRecord>;
  check: DeckCheck;
}

const PREVIEW_PER_ZONE = 12;

@Component({
  selector: 'app-deck-import-panel',
  imports: [CardTile],
  templateUrl: './deck-import-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckImportPanel {
  private readonly cardData = inject(CardDataService);
  private readonly repo = inject(DeckRepository);

  /** Existing decks that may be replaced by the import. */
  readonly decks = input<DeckRecord[]>([]);
  readonly imported = output<string>();

  protected readonly zones = DECK_ZONES;
  protected readonly zoneLabel = ZONE_LABEL;
  protected readonly previewLimit = PREVIEW_PER_ZONE;

  protected readonly text = signal('');
  protected readonly fileName = signal('');
  protected readonly deckName = signal('');
  protected readonly target = signal('new');
  protected readonly errors = signal<ParseIssue[]>([]);
  protected readonly preview = signal<Preview | null>(null);
  protected readonly busy = signal(false);
  protected readonly downloadMessage = signal('');

  protected readonly canConfirm = computed(() => !!this.preview() && (this.target() !== 'new' || !!this.deckName().trim()));

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.reset();
    if (file.size > MAX_YDK_LENGTH) {
      this.errors.set([{ message: `檔案「${file.name}」過大（超過 256 KB），不像是 YDK 牌組檔。` }]);
      return;
    }
    this.fileName.set(file.name);
    if (!this.deckName()) this.deckName.set(file.name.replace(/\.ydk$/i, ''));
    this.text.set(await file.text());
    await this.parse();
  }

  protected async parse(): Promise<void> {
    this.preview.set(null);
    this.downloadMessage.set('');
    const { format, result } = parseDeckText(this.text());
    if (!result.ok || format === 'unknown') {
      this.errors.set(result.ok ? [] : result.errors);
      return;
    }
    this.errors.set([]);
    const cards = await this.cardData.getMany(deckCardIds(result.deck));
    this.preview.set({ format, deck: result.deck, cards, check: checkDeck(result.deck, cards) });
  }

  /** Explicit network action — the only way the import contacts the card data source. */
  protected async downloadCards(): Promise<void> {
    const preview = this.preview();
    if (!preview) return;
    this.busy.set(true);
    const result = await this.cardData.downloadMissing(preview.check.unresolvedIds);
    const cards = await this.cardData.getMany(deckCardIds(preview.deck));
    this.preview.set({ ...preview, cards, check: checkDeck(preview.deck, cards) });
    this.busy.set(false);
    this.downloadMessage.set(
      result.error ??
        (result.unknownIds.length
          ? `已下載 ${result.added} 張；資料來源查無 ${result.unknownIds.length} 個 ID：${result.unknownIds.join('、')}。可儲存為草稿，但不能用於正式查詢。`
          : `已下載 ${result.added} 張卡片資料。`),
    );
  }

  protected async confirm(): Promise<void> {
    const preview = this.preview();
    if (!preview || !this.canConfirm()) return;
    const now = new Date().toISOString();
    const existing = this.decks().find((d) => d.id === this.target());
    if (existing && !confirm(`確定要以匯入內容取代牌組「${existing.name}」的主牌／額外／備牌嗎？`)) return;

    const base = existing ?? newDeck(this.deckName().trim(), now);
    const deck: DeckRecord = {
      ...base,
      main: preview.deck.main,
      extra: preview.deck.extra,
      side: preview.deck.side,
      version: existing ? existing.version + 1 : 1,
      source: { type: preview.format, ref: this.fileName() || undefined },
      importWarnings: preview.check.errors.length ? [...preview.check.errors] : undefined,
      updatedAt: now,
    };
    await this.repo.save(deck);
    this.imported.emit(`已匯入「${deck.name}」${preview.check.queryable ? '' : '（草稿：尚未通過牌表檢核，不能用於正式查詢）'}`);
    this.reset();
    this.text.set('');
    this.deckName.set('');
    this.target.set('new');
  }

  protected cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.preview.set(null);
    this.errors.set([]);
    this.fileName.set('');
    this.downloadMessage.set('');
  }
}
