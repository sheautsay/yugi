import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { CardDataService } from '../core/card-data.service';
import { CardImageService } from '../core/card-image.service';
import { CardRecord, MdBan } from '../core/models';

const KIND_LABEL = { monster: '怪獸', spell: '魔法', trap: '陷阱', unknown: '其他' } as const;
const BAN_LABEL: Record<string, string> = { Forbidden: '禁止', Limited: '限制', 'Semi-Limited': '準限制' };

/** Card details in a modal dialog; the full-size image is downloaded only when it opens (G19-3). */
@Component({
  selector: 'app-card-detail',
  template: `
    <dialog #dialog class="card-detail" aria-labelledby="card-detail-title" (close)="closed.emit()">
      @if (card(); as c) {
        <div class="layout">
          <div class="image">
            @if (fullUrl(); as url) {
              <img [src]="url" [alt]="c.nameEn" />
            } @else {
              <div class="fallback">
                <strong>{{ c.nameZhTw ?? c.nameEn }}</strong>
                <span>ID {{ c.cardId }}</span>
                <span class="muted">{{ imageState() }}</span>
              </div>
            }
          </div>
          <div class="info">
            <h2 id="card-detail-title">{{ c.nameZhTw ?? c.nameEn }}</h2>
            <p class="muted">{{ c.nameZhTw ? c.nameEn : '（尚無繁體中文名稱）' }}</p>
            <dl>
              <dt>卡片 ID</dt>
              <dd>{{ c.cardId }}</dd>
              <dt>類型</dt>
              <dd>{{ kindLabel[c.kind] }}{{ c.typeLine ? '・' + c.typeLine : '' }}</dd>
              @if (c.kind === 'monster') {
                <dt>屬性／種族</dt>
                <dd>{{ c.attribute ?? '未填' }}／{{ c.race ?? '未填' }}</dd>
                <dt>{{ c.frameType === 'xyz' ? '階級' : c.linkval !== undefined ? 'Link' : '等級' }}</dt>
                <dd>{{ c.linkval ?? c.level ?? '未填' }}</dd>
                <dt>攻擊／守備</dt>
                <dd>{{ c.atk ?? '?' }}／{{ c.linkval !== undefined ? '—' : (c.def ?? '?') }}</dd>
              } @else if (c.race) {
                <dt>種類</dt>
                <dd>{{ c.race }}</dd>
              }
              <dt>系列</dt>
              <dd>{{ c.archetype ?? '無' }}</dd>
              <dt>卡池</dt>
              <dd>{{ c.formats?.join('、') ?? '未知（請同步完整卡片資料）' }}</dd>
              <dt>TCG／OCG 禁限（參考）</dt>
              <dd>TCG {{ banText(c.banlist?.tcg) }}／OCG {{ banText(c.banlist?.ocg) }}</dd>
              <dt>Master Duel 禁限</dt>
              <dd>{{ c.mdBan ? banText(c.mdBan) + '（你自行標註）' : '未標註（資料來源未提供 Master Duel 禁限表）' }}</dd>
            </dl>
            <h3>效果（英文原文）</h3>
            <p class="desc">{{ c.desc ?? '沒有效果文字資料，請到設定頁同步完整卡片資料。' }}</p>

            <details>
              <summary>編輯繁中名稱、俗稱與 Master Duel 禁限（自行輸入）</summary>
              <form class="stack" (submit)="$event.preventDefault(); saveNote(c)">
                <label>繁體中文名稱<input name="zh" [value]="c.nameZhTw ?? ''" maxlength="80" /></label>
                <label>俗稱（以逗號或頓號分隔）<input name="aliases" [value]="c.aliases?.join('、') ?? ''" maxlength="300" /></label>
                <label>
                  Master Duel 禁限
                  <select name="mdBan">
                    <option value="" [selected]="!c.mdBan">未標註</option>
                    <option value="Forbidden" [selected]="c.mdBan === 'Forbidden'">禁止</option>
                    <option value="Limited" [selected]="c.mdBan === 'Limited'">限制</option>
                    <option value="Semi-Limited" [selected]="c.mdBan === 'Semi-Limited'">準限制</option>
                  </select>
                </label>
                <button type="submit">儲存標註</button>
                @if (noteMessage()) {
                  <span role="status">{{ noteMessage() }}</span>
                }
              </form>
            </details>
          </div>
        </div>
        <div class="row actions"><button type="button" class="primary" (click)="close()">關閉</button></div>
      }
    </dialog>
  `,
  styles: `
    dialog { width: min(860px, calc(100vw - 24px)); max-height: calc(100vh - 24px); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
    .layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 640px) { .layout { grid-template-columns: 260px 1fr; } }
    .image img, .fallback { width: 100%; max-width: 300px; aspect-ratio: 59 / 86; border-radius: 6px; }
    .fallback { border: 2px solid #8a93a3; background: #eef0f4; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; padding: 8px; text-align: center; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .desc { white-space: pre-wrap; }
    .actions { justify-content: flex-end; margin-top: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetail {
  private readonly images = inject(CardImageService);
  private readonly cardData = inject(CardDataService);

  /** The card to show; null closes the dialog. */
  readonly card = input<CardRecord | null>(null);
  readonly closed = output<void>();
  readonly saved = output<CardRecord>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly kindLabel = KIND_LABEL;
  protected readonly fullUrl = signal<string | null>(null);
  protected readonly imageState = signal('');
  protected readonly noteMessage = signal('');

  /** Card currently shown; an updated copy of the same card (after saving notes) keeps the view. */
  private shownId: number | null = null;

  constructor() {
    effect(() => {
      const card = this.card();
      const dialog = this.dialog().nativeElement;
      if (!card) {
        this.shownId = null;
        if (dialog.open) dialog.close();
        return;
      }
      if (!dialog.open) dialog.showModal ? dialog.showModal() : dialog.setAttribute('open', '');
      if (card.cardId === this.shownId) return;
      this.shownId = card.cardId;
      this.fullUrl.set(null);
      this.noteMessage.set('');
      void this.loadImage(card.cardId);
    });
  }

  private async loadImage(cardId: number): Promise<void> {
    this.imageState.set('正在載入完整卡圖…');
    const url = await this.images.fullUrl(cardId);
    if (this.shownId !== cardId) return; // another card was opened meanwhile
    this.fullUrl.set(url);
    this.imageState.set(url ? '' : '無法下載卡圖（可能離線），以文字顯示。');
  }

  protected banText(value: string | undefined): string {
    return value ? (BAN_LABEL[value] ?? value) : '無限制';
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected async saveNote(card: CardRecord): Promise<void> {
    const form = this.dialog().nativeElement.querySelector('form')!;
    const data = new FormData(form);
    const aliases = String(data.get('aliases') ?? '')
      .split(/[,，、]/)
      .map((a) => a.trim())
      .filter(Boolean);
    const mdBan = (String(data.get('mdBan') ?? '') || undefined) as MdBan | undefined;
    const updated = await this.cardData.saveNote({ cardId: card.cardId, nameZhTw: String(data.get('zh') ?? ''), aliases, mdBan });
    if (updated) {
      this.noteMessage.set('已儲存（只存在本機，更新卡片資料時不會被覆蓋）。');
      this.saved.emit(updated);
    }
  }
}
