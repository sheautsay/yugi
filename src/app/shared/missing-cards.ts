import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Collapsed list of card IDs that have no local data; the summary sentence is shown elsewhere. */
@Component({
  selector: 'app-missing-cards',
  template: `
    @if (ids().length) {
      <details class="missing-cards">
        <summary>顯示詳細（{{ ids().length }} 種卡片）</summary>
        <p class="small muted">缺少資料的卡片 ID：{{ ids().join('、') }}</p>
      </details>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingCards {
  readonly ids = input.required<readonly number[]>();
}
