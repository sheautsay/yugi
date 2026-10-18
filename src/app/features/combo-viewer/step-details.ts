import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { effectRule, parseEffectRef } from '../../core/card-rules';
import { CardRecord, ComboStep } from '../../core/models';
import { StepState } from '../../core/rule-check';
import { PLAY_ZONE_LABEL } from '../../core/route-check';

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
      @if (step().moves?.length) {
        <dt>卡片移動</dt>
        <dd>
          <ul class="moves">
            @for (m of step().moves; track $index) {
              <li>{{ name(m.cardId) }}：{{ zone[m.from] }} → {{ zone[m.to] }}</li>
            }
          </ul>
        </dd>
      }
      @if (state(); as st) {
        <dt>本回合已使用的效果</dt>
        <dd>
          @if (st.used.length) {
            <ul class="moves">
              @for (u of st.used; track u.ref) {
                <li>{{ refText(u.ref) }}：{{ u.count }} 次</li>
              }
            </ul>
          } @else {
            無
          }
        </dd>
        <dt>目前的召喚限制</dt>
        <dd>
          @if (st.locks.length) {
            <ul class="moves">
              @for (l of st.locks; track $index) {
                <li>{{ l }}</li>
              }
            </ul>
          } @else {
            無
          }
        </dd>
      }
    </dl>
  `,
  styles: `
    .description { white-space: pre-wrap; margin: 4px 0 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .moves { margin: 0; padding-left: 1.2em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepDetails {
  readonly step = input.required<ComboStep>();
  readonly cards = input.required<Map<number, CardRecord>>();
  /** CR-008 G49-4: effects used so far this turn and the summon restrictions in force after this step (from the rule check). */
  readonly state = input<StepState | null>(null);

  protected readonly zone = PLAY_ZONE_LABEL;

  private readonly cardNames = inject(CardNamesService);

  protected name(id: number): string {
    return this.cardNames.labelOf(id, this.cards().get(id));
  }

  /** "Card name #n — what the rule table says it does" (the summary is shown only for cards in the rule table). */
  protected refText(ref: string): string {
    const parsed = parseEffectRef(ref);
    if (!parsed) return ref;
    const summary = effectRule(ref, this.cards())?.summary;
    return `${this.name(parsed.cardId)} 的效果 ${parsed.n}${summary ? `（${summary}）` : ''}`;
  }

  protected names(ids: number[] | undefined): string {
    return ids?.length ? ids.map((id) => `${this.name(id)}（ID ${id}）`).join('、') : '未填';
  }
}
