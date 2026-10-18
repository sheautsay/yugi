import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { CardDataService } from '../core/card-data.service';
import { Icon } from './icon';

/**
 * Shown only while the local card database is empty: one button that downloads it, with progress and
 * errors in place (no trip to the settings page). `compact` renders just the button and status line.
 */
@Component({
  selector: 'app-card-data-prompt',
  imports: [Icon],
  template: `
    @if (cardData.hasData() === false || state().busy) {
      <div [class.notice]="!compact()" [class.warn]="!compact()" class="data-prompt" role="status">
        @if (!compact()) {
          <strong>{{ heading() }}</strong>
          <span>起手查詢與 AI 分析需要卡片資料；下載一次後都在本機使用。</span>
        }
        <div class="row">
          <button type="button" class="primary" (click)="cardData.downloadAll()" [disabled]="state().busy">
            @if (state().busy) {
              <span class="spinner" aria-hidden="true"></span>下載中…
            } @else {
              <app-icon name="import" [size]="18" />下載卡片資料
            }
          </button>
        </div>
        @if (state().message) {
          <span [class.bad-text]="state().failed">{{ state().message }}</span>
        }
      </div>
    }
  `,
  styles: `
    .data-prompt { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .bad-text { color: var(--bad, #b3261e); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDataPrompt {
  protected readonly cardData = inject(CardDataService);
  readonly compact = input(false);
  readonly heading = input('尚未下載卡片資料');
  protected readonly state = this.cardData.fullDownload;

  constructor() {
    effect(() => {
      this.cardData.version();
      void this.cardData.refreshTotal();
    });
  }
}
