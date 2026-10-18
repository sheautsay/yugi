import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { CardDataService } from '../../core/card-data.service';
import { DECK_ZONES, DeckCheck, ParseIssue, ParsedDeck, ZONE_LABEL, checkDeck, deckCardIds, newDeck } from '../../core/deck';
import { DeckTextFormat, detectDeckFormat, parseDeckText } from '../../core/deck-import';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord, DeckRecord } from '../../core/models';
import { deckCodeError, officialDeckSearchUrl, parseNeuronDeckText, resolveNeuronDeck } from '../../core/neuron-deck';
import { SettingsService } from '../../core/settings.service';
import { MAX_YDK_LENGTH } from '../../core/ydk';
import { CardTile } from '../../shared/card-tile';
import { openExternal } from '../../shared/open-external';
import { hasExternalOpener } from '../../shared/platform-hooks';

interface Preview {
  format: Exclude<DeckTextFormat, 'unknown'>;
  deck: ParsedDeck;
  cards: Map<number, CardRecord>;
  check: DeckCheck;
  /** Official deck page sections that were read (G21). */
  sections?: Array<{ title: string; declared: number }>;
}

const FORMAT_LABEL: Record<Preview['format'], string> = { ydke: 'ydke://', ydk: 'YDK', neuron: '官方牌組頁牌表（英文）' };

const PREVIEW_PER_ZONE = 12;

@Component({
  selector: 'app-deck-import-panel',
  imports: [CardTile],
  templateUrl: './deck-import-panel.html',
  styleUrl: './deck-import-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckImportPanel {
  private readonly cardData = inject(CardDataService);
  private readonly repo = inject(DeckRepository);
  private readonly settings = inject(SettingsService);
  protected readonly cardNames = inject(CardNamesService);
  /** Desktop app: links open in the system browser, not a new tab. */
  protected readonly systemBrowser = hasExternalOpener();

  /** Existing decks that may be replaced by the import. */
  readonly decks = input<DeckRecord[]>([]);
  readonly imported = output<string>();

  protected readonly zones = DECK_ZONES;
  protected readonly zoneLabel = ZONE_LABEL;
  protected readonly previewLimit = PREVIEW_PER_ZONE;
  protected readonly formatLabel = FORMAT_LABEL;

  protected readonly deckCode = signal('');
  protected readonly codeError = signal('');
  protected readonly codeOpened = signal(false);
  /** Card names from a pasted official deck list that the local card database does not know. */
  protected readonly unknownNames = signal<string[]>([]);

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

  /**
   * G21: only opens the official public Deck Search in a new tab — the app itself never requests
   * the official site (its terms forbid automated retrieval without written consent).
   */
  protected openOfficial(): void {
    const error = deckCodeError(this.deckCode());
    this.codeError.set(error ?? '');
    this.codeOpened.set(!error);
    if (!error) openExternal(officialDeckSearchUrl(this.deckCode()));
  }

  protected async parse(): Promise<void> {
    this.preview.set(null);
    this.downloadMessage.set('');
    this.unknownNames.set([]);
    if (detectDeckFormat(this.text()) === 'neuron') {
      await this.parseOfficialList();
      return;
    }
    const { format, result } = parseDeckText(this.text());
    if (!result.ok || format === 'unknown') {
      this.errors.set(result.ok ? [] : result.errors);
      return;
    }
    this.errors.set([]);
    const cards = await this.cardData.getMany(deckCardIds(result.deck));
    this.preview.set({ format, deck: result.deck, cards, check: checkDeck(result.deck, cards, this.cardNames.nameLabel) });
  }

  /** Deck list copied from the official deck page: check section totals, then map names locally. */
  private async parseOfficialList(): Promise<void> {
    const parsed = parseNeuronDeckText(this.text());
    if (!parsed.ok) {
      this.errors.set(parsed.errors);
      return;
    }
    const { deck, unknownNames } = resolveNeuronDeck(parsed.sections, await this.cardData.allCards());
    if (unknownNames.length) {
      this.unknownNames.set(unknownNames);
      this.errors.set(unknownNames.map((name) => ({ message: `本機卡片資料庫找不到卡名「${name}」` })));
      return;
    }
    this.errors.set([]);
    const cards = await this.cardData.getMany(deckCardIds(deck));
    this.preview.set({ format: 'neuron', deck, cards, check: checkDeck(deck, cards, this.cardNames.nameLabel), sections: parsed.sections.map((s) => ({ title: s.title, declared: s.declared })) });
  }

  /** Explicit network action: full card data, then parse the pasted official list again. */
  protected async syncAndRetry(): Promise<void> {
    this.busy.set(true);
    this.downloadMessage.set('正在下載完整卡片資料（約 24 MB）…');
    const result = await this.cardData.syncAll(this.settings.settings().cardPool);
    this.busy.set(false);
    this.downloadMessage.set(result.status === 'failed' ? result.error : '');
    if (result.status !== 'failed') await this.parse();
  }

  /** Explicit network action — the only way the import contacts the card data source. */
  protected async downloadCards(): Promise<void> {
    const preview = this.preview();
    if (!preview) return;
    this.busy.set(true);
    const result = await this.cardData.downloadMissing(preview.check.unresolvedIds);
    const cards = await this.cardData.getMany(deckCardIds(preview.deck));
    this.preview.set({ ...preview, cards, check: checkDeck(preview.deck, cards, this.cardNames.nameLabel) });
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
      source:
        preview.format === 'neuron'
          ? { type: 'deck-code', ref: this.deckCode().trim() || undefined }
          : { type: preview.format, ref: this.fileName() || undefined },
      importWarnings: preview.check.errors.length ? [...preview.check.errors] : undefined,
      updatedAt: now,
    };
    await this.repo.save(deck);
    this.imported.emit(`已匯入「${deck.name}」${preview.check.queryable ? '' : '（草稿：尚未通過牌表檢核，不能用於正式查詢）'}`);
    this.reset();
    this.text.set('');
    this.deckName.set('');
    this.target.set('new');
    this.deckCode.set('');
    this.codeOpened.set(false);
  }

  protected cancel(): void {
    this.reset();
  }

  protected sectionSummary(sections: ReadonlyArray<{ title: string; declared: number }>): string {
    const read = sections.map((s) => `${s.title} ${s.declared}`).join('・');
    const missing = ['Monster Cards', 'Spell Cards', 'Trap Cards', 'Extra Deck', 'Side Deck'].filter((t) => !sections.some((s) => s.title.toLowerCase() === t.toLowerCase()));
    return `已讀取官方牌表區段：${read}${missing.length ? `；未包含：${missing.join('、')}（視為 0 張，請確認官方頁上確實沒有）` : ''}`;
  }

  private reset(): void {
    this.preview.set(null);
    this.errors.set([]);
    this.unknownNames.set([]);
    this.fileName.set('');
    this.downloadMessage.set('');
  }
}
