import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { checkHand } from '../../core/hand';
import { LayoutRepository } from '../../core/layout-repository';
import { CardCount, CardRecord, HandLayoutPreset, HandRecognitionSlot, HandRegion, HandSize } from '../../core/models';
import { regionsFromRow, resolvedHand, screenshotFileError, screenshotSizeError, sortLeftToRight } from '../../core/recognition';
import { CardTile } from '../card-tile';
import { HandRecognitionService, thumbnail } from './hand-recognition.service';

const STATUS_TEXT: Record<HandRecognitionSlot['status'], string> = {
  confident: '辨識信心高',
  uncertain: '不確定，請選擇正確的卡',
  unrecognized: '無法辨識，請選擇正確的卡',
  'user-selected': '已手動選擇',
};

/** Default starting box: bottom-centre strip where Master Duel shows the hand. Only a starting point. */
const DEFAULT_ROW: HandRegion = { x: 0.25, y: 0.72, w: 0.5, h: 0.26 };

@Component({
  selector: 'app-screenshot-recognizer',
  imports: [CardTile],
  templateUrl: './screenshot-recognizer.html',
  styleUrl: './screenshot-recognizer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'onPaste($event)' },
})
export class ScreenshotRecognizer implements OnDestroy {
  private readonly recognition = inject(HandRecognitionService);
  private readonly layouts = inject(LayoutRepository);

  readonly main = input.required<CardCount[]>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly handSize = input.required<HandSize>();
  readonly confirmed = output<number[]>();

  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');
  private readonly injector = inject(Injector);

  protected readonly statusText = STATUS_TEXT;
  protected readonly cardNames = inject(CardNamesService);

  protected readonly previewUrl = signal<string | null>(null);
  protected readonly imageSize = signal<{ width: number; height: number } | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly mode = signal<'row' | 'single'>('row');
  protected readonly regions = signal<HandRegion[]>([]);
  protected readonly drag = signal<HandRegion | null>(null);
  protected readonly slots = signal<HandRecognitionSlot[] | null>(null);
  protected readonly thumbs = signal<string[]>([]);
  protected readonly missingRefs = signal<number[]>([]);
  protected readonly presets = signal<HandLayoutPreset[]>([]);
  protected readonly presetName = signal('');

  private bitmap: ImageBitmap | null = null;
  private dragStart: { x: number; y: number } | null = null;

  protected readonly mainOptions = computed(() =>
    this.main().map((c) => ({ cardId: c.cardId, label: `${this.cardNames.labelOf(c.cardId, this.cards().get(c.cardId))}（ID ${c.cardId}）` })),
  );
  protected readonly usablePresets = computed(() => this.presets().filter((p) => p.handSize === this.handSize()));
  protected readonly boxesReady = computed(() => this.regions().length === this.handSize());
  protected readonly hand = computed(() => {
    const slots = this.slots();
    return slots ? resolvedHand(slots) : null;
  });
  protected readonly handErrors = computed(() => {
    const hand = this.hand();
    return hand ? checkHand(this.main(), hand, this.handSize(), (id) => this.cardNames.labelOf(id, this.cards().get(id))).errors : [];
  });
  protected readonly canConfirm = computed(() => !!this.hand() && this.boxesReady() && this.handErrors().length === 0 && this.slots()?.length === this.handSize());

  constructor() {
    void this.reloadPresets();
    // Box count must follow the hand size; a size change invalidates boxes and results.
    effect(() => {
      this.handSize();
      this.regions.set([]);
      this.slots.set(null);
    });
    effect(() => void this.refreshMissing(this.main().map((c) => c.cardId)));
  }

  private async refreshMissing(ids: number[]): Promise<void> {
    this.missingRefs.set(await this.recognition.missingReferences(ids));
  }

  ngOnDestroy(): void {
    this.release();
  }

  protected async onFile(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (file) await this.load(file);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.load(file);
    else this.error.set('拖放的內容不是檔案，請拖放一張截圖圖片。');
  }

  /** Ctrl+V anywhere on the page; text pasted into form fields is left alone. */
  protected async onPaste(event: ClipboardEvent): Promise<void> {
    const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      await this.load(file);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    this.error.set('剪貼簿中沒有圖片。請先用 Win+Shift+S 截取遊戲畫面，再按 Ctrl+V。');
  }

  private async load(file: Blob & { name?: string }): Promise<void> {
    this.error.set('');
    this.message.set('');
    const typeError = screenshotFileError({ type: file.type, size: file.size, name: file.name });
    if (typeError) {
      this.error.set(typeError);
      return;
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      this.error.set('無法讀取這張圖片（檔案可能已損毀）。請重新截圖後再試。');
      return;
    }
    const sizeError = screenshotSizeError(bitmap.width, bitmap.height);
    if (sizeError) {
      bitmap.close();
      this.error.set(sizeError);
      return;
    }
    this.release();
    this.bitmap = bitmap;
    this.previewUrl.set(URL.createObjectURL(file));
    this.imageSize.set({ width: bitmap.width, height: bitmap.height });
    this.message.set(`已載入截圖（${bitmap.width}×${bitmap.height}）。截圖只在此頁記憶體中處理，不會儲存或上傳。`);
    // Bring the whole screenshot into view so the boxes can be drawn right away (CR-012).
    afterNextRender(() => this.overlay()?.nativeElement.scrollIntoView({ block: 'nearest' }), { injector: this.injector });
  }

  /** Frees the screenshot (object URL + decoded bitmap). */
  protected release(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.bitmap?.close();
    this.bitmap = null;
    this.previewUrl.set(null);
    this.imageSize.set(null);
    this.regions.set([]);
    this.slots.set(null);
    this.thumbs.set([]);
  }

  protected pointerDown(event: PointerEvent): void {
    const p = this.relative(event);
    if (!p) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.dragStart = p;
    this.drag.set({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  protected pointerMove(event: PointerEvent): void {
    const p = this.relative(event);
    if (!p || !this.dragStart) return;
    const s = this.dragStart;
    this.drag.set({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }

  protected pointerUp(): void {
    const rect = this.drag();
    this.drag.set(null);
    this.dragStart = null;
    if (!rect || rect.w < 0.01 || rect.h < 0.01) return;
    this.slots.set(null);
    if (this.mode() === 'row') {
      this.regions.set(regionsFromRow(rect, this.handSize()));
    } else if (this.regions().length >= this.handSize()) {
      this.error.set(`已框選 ${this.handSize()} 張，請先刪除多餘的框。`);
    } else {
      this.regions.update((r) => sortLeftToRight([...r, rect]));
    }
  }

  protected useDefaultRow(): void {
    this.slots.set(null);
    this.regions.set(regionsFromRow(DEFAULT_ROW, this.handSize()));
    this.message.set('已套用預設位置（畫面下方中央），這只是起點，請確認每個框都對準一張卡。');
  }

  protected removeRegion(index: number): void {
    this.slots.set(null);
    this.regions.update((r) => r.filter((_, i) => i !== index));
  }

  protected clearRegions(): void {
    this.slots.set(null);
    this.regions.set([]);
  }

  protected applyPreset(id: string): void {
    const preset = this.presets().find((p) => p.id === id);
    const size = this.imageSize();
    if (!preset || !size) return;
    this.slots.set(null);
    this.regions.set(preset.regions.map((r) => ({ ...r })));
    const ratio = size.width / size.height;
    this.message.set(
      Math.abs(ratio - preset.aspectRatio) > 0.02
        ? `已套用版型「${preset.name}」，但截圖長寬比與版型不同，框線可能沒對準，請檢查。`
        : `已套用版型「${preset.name}」。`,
    );
  }

  protected async savePreset(): Promise<void> {
    const size = this.imageSize();
    const name = this.presetName().trim();
    if (!size || !name || !this.boxesReady()) return;
    await this.layouts.save({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      name,
      handSize: this.handSize(),
      aspectRatio: size.width / size.height,
      regions: this.regions(),
      createdAt: new Date().toISOString(),
    });
    this.presetName.set('');
    this.message.set(`已儲存版型「${name}」（只存框線位置，不含截圖）。`);
    await this.reloadPresets();
  }

  protected async downloadReferences(): Promise<void> {
    this.busy.set(true);
    const missing = this.missingRefs().length;
    this.message.set(`正在下載 ${missing} 張辨識用卡圖（逐張下載，約需 ${Math.ceil(missing / 4)} 秒）…`);
    const result = await this.recognition.downloadReferences(this.main().map((c) => c.cardId));
    this.busy.set(false);
    this.message.set(result.failed.length ? `下載完成，但 ${result.failed.length} 張失敗：${result.error}` : `已下載 ${result.downloaded} 張辨識用卡圖。`);
    await this.refreshMissing(this.main().map((c) => c.cardId));
    if (this.slots()) await this.recognize();
  }

  protected async recognize(): Promise<void> {
    if (!this.bitmap || !this.boxesReady()) return;
    this.busy.set(true);
    const counts = new Map(this.main().map((c) => [c.cardId, c.count]));
    const { slots, missingReferences } = await this.recognition.recognize(this.bitmap, this.regions(), counts);
    this.missingRefs.set(missingReferences);
    this.thumbs.set(this.regions().map((r) => thumbnail(this.bitmap!, r)));
    this.slots.set(slots);
    this.busy.set(false);
  }

  protected choose(index: number, value: string): void {
    const cardId = Number(value);
    if (!cardId) return;
    this.slots.update((slots) => slots!.map((s) => (s.index === index ? { ...s, chosenCardId: cardId, status: 'user-selected' as const } : s)));
  }

  protected confirm(): void {
    const hand = this.hand();
    if (!hand || !this.canConfirm()) return;
    this.confirmed.emit(hand);
    this.release();
    this.message.set('已套用辨識結果，截圖已從記憶體釋放。');
  }

  protected percent(score: number): string {
    return `${Math.round(Math.max(0, score) * 100)}%`;
  }

  private relative(event: PointerEvent): { x: number; y: number } | null {
    const el = this.overlay()?.nativeElement;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  }

  private async reloadPresets(): Promise<void> {
    this.presets.set(await this.layouts.list());
  }
}
