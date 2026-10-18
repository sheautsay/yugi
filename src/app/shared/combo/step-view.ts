import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ACTION_LABEL } from '../../core/labels';
import { CardRecord, ComboRoute } from '../../core/models';
import { StepState } from '../../core/rule-check';
import { StepNavigator } from '../../core/step-navigator';
import { CardTile } from '../card-tile';
import { StepDetails } from './step-details';

/** Mode B — one step at a time; a manual reading guide that does nothing in the game. */
@Component({
  selector: 'app-step-view',
  imports: [RouterLink, CardTile, StepDetails],
  template: `
    <p class="progress" aria-live="polite"><strong>第 {{ navigator().current() }} / {{ navigator().total() }} 步</strong></p>
    @if (step(); as s) {
      <div class="row actors">
        @for (id of s.actorCardIds; track $index) {
          <app-card-tile [cardId]="id" [card]="cards().get(id)" [caption]="true" />
        }
      </div>
      <h3><span class="badge">{{ actionLabel[s.actionType] }}</span> {{ s.title }}</h3>
      @if (s.warning) {
        <p class="notice warn" role="note">⚠ 注意事項：{{ s.warning }}</p>
      }
      @if (detailed()) {
        <app-step-details [step]="s" [cards]="cards()" [state]="stateOf(s.order)" />
      } @else {
        <p>位置：{{ s.fromZone ?? '未填' }} → {{ s.toZone ?? '未填' }}</p>
      }
    }
    <div class="row nav">
      <button type="button" (click)="navigator().prev()" [disabled]="navigator().atFirst()">上一步</button>
      <button type="button" class="primary" (click)="navigator().next()" [disabled]="navigator().atLast()">下一步</button>
      <label class="inline">
        指定步驟
        <select [value]="navigator().current()" (change)="navigator().goTo(+$any($event.target).value)">
          @for (s of route().steps; track s.id) {
            <option [value]="s.order" [selected]="s.order === navigator().current()">第 {{ s.order }} 步</option>
          }
        </select>
      </label>
      <button type="button" (click)="jumpToEnd.emit()">跳至終場</button>
      <a class="button" [routerLink]="backLink()">返回列表</a>
      <label class="inline"><input type="checkbox" [checked]="detailed()" (change)="detailed.set($any($event.target).checked)" /> 詳細</label>
    </div>
    <p class="muted">可用鍵盤 ← → 切換步驟。這是手動閱讀導覽：按「下一步」不會對遊戲做任何事。</p>
  `,
  styles: `
    .progress { font-size: 1.1rem; margin: 0 0 8px; }
    .actors { margin-bottom: 6px; }
    h3 { font-size: 1.1rem; }
    .nav { margin-top: 10px; }
    .inline { flex-direction: row; align-items: center; gap: 6px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepView {
  readonly route = input.required<ComboRoute>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly navigator = input.required<StepNavigator>();
  /** CR-008: per-step rule states (only when the viewer knows the deck). */
  readonly states = input<StepState[]>([]);
  /** The result list this route was opened from (hand query or Combo list). */
  readonly backLink = input<string[]>(['/combos']);
  readonly jumpToEnd = output<void>();

  protected readonly actionLabel = ACTION_LABEL;
  /** 精簡 hides secondary fields but never the warning (F08). */
  protected readonly detailed = signal(true);
  protected readonly step = computed(() => this.route().steps[this.navigator().current() - 1]);

  protected stateOf(order: number): StepState | null {
    return this.states().find((x) => x.order === order) ?? null;
  }
}
