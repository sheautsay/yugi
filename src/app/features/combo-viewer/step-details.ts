import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { displayName } from '../../core/deck';
import { CardRecord, ComboStep } from '../../core/models';

/** Every field of a step; anything not provided is shown as「未填」(F07). */
@Component({
  selector: 'app-step-details',
  template: `
    <p class="description">{{ step().description }}</p>
    <dl>
      <dt>位置</dt>
      <dd>{{ step().fromZone ?? '未填' }} → {{ step().toZone ?? '未填' }}</dd>
      <dt>執行的卡</dt>
      <dd>{{ names(step().actorCardIds) }}</dd>
      <dt>目標</dt>
      <dd>{{ names(step().targetCardIds) }}</dd>
      <dt>素材</dt>
      <dd>{{ names(step().materialCardIds) }}</dd>
      <dt>代價</dt>
      <dd>{{ step().costText ?? '未填' }}</dd>
      <dt>效果</dt>
      <dd>{{ step().effectText ?? '未填' }}</dd>
      <dt>結果</dt>
      <dd>{{ step().resultText ?? '未填' }}</dd>
      <dt>原因</dt>
      <dd>{{ step().reason ?? '未填' }}</dd>
    </dl>
  `,
  styles: `
    .description { white-space: pre-wrap; margin: 4px 0 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepDetails {
  readonly step = input.required<ComboStep>();
  readonly cards = input.required<Map<number, CardRecord>>();

  protected names(ids: number[] | undefined): string {
    return ids?.length ? ids.map((id) => `${displayName(this.cards().get(id))}（ID ${id}）`).join('、') : '未填';
  }
}
