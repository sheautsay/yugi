import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { FtkLeaf } from '../../core/ftk-check';
import { ACTION_LABEL } from '../../core/labels';
import { CardRecord, ComboRoute, ComboStep, RouteBranch } from '../../core/models';
import { clauseText } from '../../core/route-tree';
import { TEXT } from '../../core/texts';

/** B7: a first-turn-kill plan as a tree: the steps in order, and under each random step the branches it leads to. */
@Component({
  selector: 'app-ftk-tree',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #list let-steps let-chain="chain">
      <ol class="ftk-steps">
        @for (s of steps; track s.id) {
          <li>
            <span class="badge">{{ label(s) }}</span> {{ s.title }}
            @if (s.random; as r) {
              <span class="muted small">（隨機 {{ r.count }} 張 → {{ zone(r.to) }}）</span>
            }
            @if (s.branches?.length) {
              <ul class="ftk-branches" aria-label="抽牌後的分支">
                @for (b of s.branches; track b.id) {
                  <li>
                    <strong>{{ condition(b) }}</strong>
                    @if (verdict(chain, b); as v) {
                      <span class="badge" [class.ok]="v.killed" [class.bad]="!v.killed">{{ v.text }}</span>
                    }
                    <ng-container *ngTemplateOutlet="list; context: { $implicit: b.steps, chain: next(chain, b) }" />
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ol>
    </ng-template>
    <ng-container *ngTemplateOutlet="list; context: { $implicit: route().steps, chain: [] }" />
  `,
  styles: `
    .ftk-steps, .ftk-branches { margin: 4px 0 0; padding-left: 1.3em; }
    .ftk-branches { list-style: '↳ '; border-left: 2px solid var(--border); margin-left: 4px; }
    .ftk-branches > li { margin: 6px 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FtkTree {
  private readonly names = inject(CardNamesService);
  readonly route = input.required<ComboRoute>();
  readonly cards = input.required<ReadonlyMap<number, CardRecord>>();
  /** From {@link checkFtkRoute}; lets each end of the tree say whether the kill is reached. */
  readonly leaves = input<readonly FtkLeaf[]>([]);

  protected label(s: ComboStep): string {
    return ACTION_LABEL[s.actionType];
  }

  protected zone(to: 'hand' | 'gy' | 'banished'): string {
    return { hand: '手牌', gy: '墓地', banished: '除外' }[to];
  }
  private readonly byKey = computed(() => new Map(this.leaves().map((l) => [l.key, l])));
  private readonly name = (id: number) => this.names.labelOf(id, this.cards().get(id));

  protected condition(b: RouteBranch): string {
    return b.when ? `抽到 ${clauseText(b.when, this.name)}` : '否則（都沒有）';
  }

  protected next(chain: readonly string[], b: RouteBranch): string[] {
    return [...chain, b.id];
  }

  /** The end of a way through the tree says whether it reaches 0; a branch that continues says nothing. */
  protected verdict(chain: readonly string[], b: RouteBranch): { killed: boolean; text: string } | null {
    if (b.steps.some((s: ComboStep) => s.branches?.length)) return null;
    const leaf = this.byKey().get([...chain, b.id].join('/'));
    if (!leaf) return null;
    return { killed: leaf.success, text: leaf.success ? TEXT.ftk.killed : leaf.opponentLp <= 0 ? TEXT.ftk.claimedWrong : TEXT.ftk.notKilled(Math.max(0, leaf.opponentLp)) };
  }
}
