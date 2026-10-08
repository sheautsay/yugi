import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { displayName } from '../../core/deck';
import { RouteResult } from '../../core/matcher';
import { CardRecord, ComboRoute, MatchKind } from '../../core/models';
import { CardTile } from '../../shared/card-tile';

export const KIND_LABEL: Record<MatchKind, string> = {
  available: '可用（已驗證）',
  unverified: '未驗證',
  unknown: '資料不足',
  unavailable: '不符合',
};

export function setupText(route: ComboRoute): string {
  const s = route.conditions.setup;
  const order = s.turnOrder === 'first' ? '先攻' : s.turnOrder === 'second' ? '後攻' : '先後攻皆可';
  return [order, s.emptyBoard ? '雙方空場' : '', s.normalSummonAvailable ? '需通常召喚權' : '', s.noInterruption ? '假設無干擾' : ''].filter(Boolean).join('・');
}

@Component({
  selector: 'app-route-result-list',
  imports: [RouterLink, CardTile],
  template: `
    <ul class="plain stack">
      @for (r of items(); track r.route.id) {
        <li class="result" [attr.data-kind]="r.match.kind">
          <div class="row">
            <strong>{{ r.route.name }}</strong>
            <span class="badge" [class.ok]="r.match.kind === 'available'" [class.warn]="r.match.kind !== 'available'">{{ kindLabel[r.match.kind] }}</span>
            <span class="muted">{{ r.route.archetype }}・{{ setupText(r.route) }}</span>
          </div>
          @if (r.match.matchedHandAllocation) {
            <p class="muted">使用起手：{{ allocationText(r) }}</p>
          }
          @if (r.match.reasons.length) {
            <ul class="reasons">
              @for (reason of r.match.reasons; track $index) {
                <li>{{ reason.textZhTw }}</li>
              }
            </ul>
          }
          @if (r.route.endBoard.length) {
            <div class="row" aria-label="預計終場">
              <span class="muted">預計終場：</span>
              @for (e of r.route.endBoard; track $index) {
                <app-card-tile [cardId]="e.cardId" [card]="cards().get(e.cardId)" [count]="e.count" size="s" />
              }
            </div>
          }
          <a class="button" [routerLink]="['/combos', r.route.id]" [queryParams]="{ deck: deckId() }">查看完整展開</a>
        </li>
      }
    </ul>
  `,
  styles: `
    .result { border-top: 1px solid var(--border); padding-top: 10px; }
    .reasons { margin: 4px 0; padding-left: 1.2em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteResultList {
  readonly items = input.required<RouteResult[]>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly deckId = input<string>();

  protected readonly kindLabel = KIND_LABEL;
  protected readonly setupText = setupText;

  protected allocationText(r: RouteResult): string {
    return (r.match.matchedHandAllocation ?? [])
      .flatMap((a) => a.cardIds)
      .map((id) => displayName(this.cards().get(id)))
      .join('、');
  }
}
