import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { branchFor, checkFtkRoute, describeCondition, ftkInfoOf, isFtkRoute, listProbability, nodeOdds, remainingPool, walkLife } from '../../core/ftk-check';
import { ACTION_LABEL } from '../../core/labels';
import { matchRoutes } from '../../core/matcher';
import { CardRecord, ComboRoute, ComboStep, DeckRecord, RouteBranch } from '../../core/models';
import { TEXT, pct } from '../../core/texts';
import { CardTile } from '../../shared/card-tile';

interface Position {
  /** The step list being walked (the main line, or the continuation of a branch). */
  steps: readonly ComboStep[];
  index: number;
  /** Branch ids taken so far. */
  chain: readonly string[];
  /** Cards that turned up in the draws so far (all of them, in order). */
  known: readonly number[];
  /** Steps of the lists left behind (for the life points and the step list). */
  before: readonly ComboStep[];
  /** Where to go back to when the last reveal is undone. */
  back: Position | null;
}

/** B7: the battle mode of a first-turn-kill deck: plans ranked by chance, then followed step by step with the real draws entered. */
@Component({
  selector: 'app-battle-ftk',
  imports: [CardTile],
  templateUrl: './battle-ftk.html',
  styleUrl: './battle-page.css',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattleFtk {
  private readonly names = inject(CardNamesService);

  readonly deck = input.required<DeckRecord>();
  readonly cards = input.required<ReadonlyMap<number, CardRecord>>();
  readonly hand = input.required<readonly number[]>();
  readonly routes = input.required<readonly ComboRoute[]>();
  readonly topN = input(5);
  /** True while one plan is open, so the page can fold its hand controls away. */
  readonly opened = output<boolean>();

  protected readonly t = TEXT.battle;
  protected readonly f = TEXT.ftk;
  protected readonly pct = pct;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly position = signal<Position | null>(null);
  protected readonly pending = signal<number[]>([]);

  constructor() {
    effect(() => this.opened.emit(!!this.selected()));
  }

  protected readonly name = (id: number) => this.names.labelOf(id, this.cards().get(id));
  protected label(s: ComboStep): string {
    return ACTION_LABEL[s.actionType];
  }

  /** Each FTK plan of the library is checked once per deck/card data. */
  private readonly checks = computed(() => new Map(this.routes().filter(isFtkRoute).map((r) => [r.id, checkFtkRoute(r, this.deck(), { cards: this.cards(), name: this.name })] as const)));

  /** Plans that match the hand, best chance first. */
  protected readonly ranking = computed(() => {
    const deck = this.deck();
    const hand = this.hand();
    const pool = remainingPool(deck, hand);
    const matched = matchRoutes(this.routes().filter(isFtkRoute), deck, [...hand], { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true }, { name: this.name, knownCardIds: new Set(this.cards().keys()), cards: this.cards() });
    const rows = matched
      .filter((r) => r.match.kind === 'available' || r.match.kind === 'unverified')
      .map((r) => {
        const check = this.checks().get(r.route.id)!;
        let p = 0;
        try {
          p = listProbability(r.route, r.route.steps, check.leaves, pool);
        } catch {
          p = 0;
        }
        return { route: r.route, check, p, tested: r.match.kind === 'available', handNeeded: r.route.conditions.handAllOf.reduce((n, c) => n + c.count, 0), steps: r.route.steps.length };
      });
    rows.sort((a, b) => b.p - a.p || Number(b.tested) - Number(a.tested) || a.handNeeded - b.handNeeded || a.steps - b.steps || a.route.name.localeCompare(b.route.name, 'zh-Hant'));
    return rows.slice(0, this.topN()).map((r, i) => ({ ...r, rank: i + 1 }));
  });

  protected readonly selected = computed(() => this.ranking().find((r) => r.route.id === this.selectedId()) ?? null);

  /** The deck as it is now: not in the hand and not turned up in a draw. */
  private readonly pool = computed(() => remainingPool(this.deck(), [...this.hand(), ...(this.position()?.known ?? [])]));

  protected readonly current = computed(() => {
    const p = this.position();
    return p ? (p.steps[p.index] ?? null) : null;
  });

  /** Waiting for the cards of a random step that has branches. */
  protected readonly revealing = computed(() => {
    const step = this.current();
    const p = this.position();
    return step?.random && step.branches?.length && p && p.index === p.steps.length - 1 ? step : null;
  });

  protected readonly chance = computed(() => {
    const sel = this.selected();
    const p = this.position();
    if (!sel || !p) return null;
    try {
      return listProbability(sel.route, p.steps, sel.check.leaves, this.pool(), p.chain);
    } catch {
      return null;
    }
  });

  protected readonly odds = computed(() => {
    const sel = this.selected();
    const step = this.revealing();
    const p = this.position();
    if (!sel || !step || !p) return [];
    try {
      return nodeOdds(sel.route, step, sel.check.leaves, this.pool(), p.chain);
    } catch {
      return [];
    }
  });

  /** What each branch would be if the cards typed so far were the whole draw (the first whose condition holds). */
  protected readonly suggested = computed(() => {
    const step = this.revealing();
    return step && this.pending().length === step.random!.count ? branchFor(step, this.pending()) : null;
  });

  protected readonly life = computed(() => {
    const sel = this.selected();
    const p = this.position();
    if (!sel || !p) return null;
    const done = [...p.before, ...p.steps.slice(0, p.index + 1)];
    const r = walkLife(done, { cards: this.cards(), info: ftkInfoOf(sel.route), gyBefore: () => [] });
    return { opponent: Math.max(0, r.opponentLp), self: r.selfLp, killed: r.opponentLp <= 0 };
  });

  /** The steps shown: everything behind plus the list being walked. */
  protected readonly shownSteps = computed(() => {
    const p = this.position();
    return p ? [...p.before.map((s) => ({ s, state: 'done' as const })), ...p.steps.map((s, i) => ({ s, state: i < p.index ? ('done' as const) : i === p.index ? ('current' as const) : ('todo' as const) }))] : [];
  });

  protected readonly pickable = computed(() => [...this.pool()].filter(([id, n]) => id > 0 && n > 0).map(([cardId, left]) => ({ cardId, left: left - this.pending().filter((x) => x === cardId).length, card: this.cards().get(cardId) })));

  protected readonly atEnd = computed(() => {
    const p = this.position();
    const step = this.current();
    return !!p && !!step && p.index === p.steps.length - 1 && !step.branches?.length;
  });

  protected select(id: string | null): void {
    this.selectedId.set(id);
    this.pending.set([]);
    const route = this.ranking().find((r) => r.route.id === id)?.route;
    this.position.set(route ? { steps: route.steps, index: 0, chain: [], known: [], before: [], back: null } : null);
  }

  protected next(): void {
    const p = this.position();
    if (!p || p.index >= p.steps.length - 1) return;
    this.position.set({ ...p, index: p.index + 1 });
  }

  protected prev(): void {
    const p = this.position();
    if (!p || p.index === 0) return;
    this.position.set({ ...p, index: p.index - 1 });
  }

  protected pick(cardId: number): void {
    const step = this.revealing();
    if (!step || this.pending().length >= step.random!.count) return;
    this.pending.update((list) => [...list, cardId]);
  }

  protected unpick(index: number): void {
    this.pending.update((list) => list.filter((_, i) => i !== index));
  }

  /** Takes the branch the real cards lead to, and carries on from there with the real deck. */
  protected confirm(): void {
    const p = this.position();
    const step = this.revealing();
    const branch = this.suggested();
    if (!p || !step || !branch) return;
    const revealed = this.pending();
    this.position.set({ steps: branch.steps, index: 0, chain: [...p.chain, branch.id], known: [...p.known, ...revealed], before: [...p.before, ...p.steps], back: p });
    this.pending.set([]);
  }

  /** Goes back to the draw to type other cards. */
  protected undo(): void {
    const p = this.position();
    if (!p?.back) {
      this.pending.set([]);
      return;
    }
    this.position.set({ ...p.back, index: p.back.steps.length - 1 });
    this.pending.set([]);
  }

  protected condition(b: RouteBranch): string {
    return describeCondition(b, this.name);
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.selected()) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.prev();
    }
  }
}
