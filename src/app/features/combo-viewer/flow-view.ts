import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { ACTION_LABEL } from '../../core/labels';
import { CardRecord, ComboRoute } from '../../core/models';
import { StepNavigator } from '../../core/step-navigator';
import { CardTile } from '../../shared/card-tile';
import { StepDetails } from './step-details';

const SCALES = [0.6, 0.75, 0.9, 1, 1.15, 1.3];

/** Mode A — the whole route as a scrollable flow of numbered nodes. */
@Component({
  selector: 'app-flow-view',
  imports: [CardTile, StepDetails],
  template: `
    <div class="row toolbar">
      <span>排列：</span>
      <button type="button" (click)="orientation.set('vertical')" [attr.aria-pressed]="orientation() === 'vertical'">垂直</button>
      <button type="button" (click)="orientation.set('horizontal')" [attr.aria-pressed]="orientation() === 'horizontal'">水平</button>
      <span>縮放：</span>
      <button type="button" (click)="zoom(-1)" [disabled]="scaleIndex() === 0">縮小</button>
      <span aria-live="polite">{{ percent() }}%</span>
      <button type="button" (click)="zoom(1)" [disabled]="scaleIndex() === scales.length - 1">放大</button>
    </div>
    <div class="canvas" [class.horizontal]="orientation() === 'horizontal'">
      <ol class="flow" [style.zoom]="scales[scaleIndex()]">
        @for (step of route().steps; track step.id) {
          <li class="node" [class.current]="step.order === navigator().current()" [attr.data-order]="step.order">
            <button
              type="button"
              class="node-head"
              (click)="navigator().goTo(step.order)"
              [attr.aria-current]="step.order === navigator().current() ? 'step' : null"
              [attr.aria-label]="'第 ' + step.order + ' 步：' + step.title"
            >
              <span class="num">{{ step.order }}</span>
              <span class="tiles">
                @for (id of step.actorCardIds; track $index) {
                  <app-card-tile [cardId]="id" [card]="cards().get(id)" size="s" />
                }
              </span>
              <span class="summary"><span class="badge">{{ actionLabel[step.actionType] }}</span> {{ step.title }}</span>
            </button>
            @if (step.warning) {
              <p class="warning">⚠ 注意：{{ step.warning }}</p>
            }
            <details>
              <summary>展開說明</summary>
              <app-step-details [step]="step" [cards]="cards()" />
            </details>
          </li>
        }
        <li class="node end-node">
          <strong>終場</strong>
          @if (route().endBoard.length === 0) {
            <span class="muted">未填</span>
          }
          <div class="row">
            @for (e of route().endBoard; track $index) {
              <app-card-tile [cardId]="e.cardId" [card]="cards().get(e.cardId)" [count]="e.count" size="s" [caption]="true" />
            }
          </div>
        </li>
      </ol>
    </div>
  `,
  styles: `
    .toolbar { margin-bottom: 8px; }
    .toolbar button { min-width: 44px; }
    .toolbar button[aria-pressed='true'] { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
    .canvas { max-height: 70vh; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; background: #fbfcfe; }
    .flow { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
    .horizontal .flow { flex-direction: row; align-items: flex-start; width: max-content; }
    .node { position: relative; border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); padding: 8px; max-width: 520px; }
    .horizontal .node { width: 220px; }
    .node.current { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(31, 95, 191, 0.25); }
    .node:not(:last-child)::after { content: '↓'; position: absolute; left: 50%; bottom: -21px; transform: translateX(-50%); color: var(--muted); font-weight: 700; }
    .horizontal .node:not(:last-child)::after { content: '→'; left: auto; right: -19px; bottom: auto; top: 40%; transform: none; }
    .node-head { width: 100%; justify-content: flex-start; flex-wrap: wrap; text-align: left; border: none; padding: 4px; background: transparent; }
    .num { background: #16263f; color: #fff; border-radius: 999px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }
    .tiles { display: flex; gap: 4px; }
    .summary { flex: 1 1 140px; }
    .warning { color: var(--warn); background: var(--warn-bg); border-radius: 6px; padding: 4px 8px; margin: 4px 0; }
    details summary { cursor: pointer; min-height: 36px; display: flex; align-items: center; color: var(--primary); }
    .end-node { border-style: dashed; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowView {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly route = input.required<ComboRoute>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly navigator = input.required<StepNavigator>();

  protected readonly actionLabel = ACTION_LABEL;
  protected readonly scales = SCALES;
  protected readonly scaleIndex = signal(SCALES.indexOf(1));
  protected readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  protected readonly percent = computed(() => Math.round(SCALES[this.scaleIndex()] * 100));

  constructor() {
    // Keep the shared current step visible after switching modes or clicking.
    effect(() => {
      const order = this.navigator().current();
      queueMicrotask(() => this.host.nativeElement.querySelector(`.node[data-order="${order}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
    });
  }

  protected zoom(delta: 1 | -1): void {
    this.scaleIndex.update((i) => Math.min(SCALES.length - 1, Math.max(0, i + delta)));
  }
}
