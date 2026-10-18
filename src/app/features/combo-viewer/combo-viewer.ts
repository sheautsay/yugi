import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, model, untracked, viewChild, inject } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { BoardSnapshot, endSnapshot } from '../../core/ai/board-snapshot';
import { VERIFICATION_LABEL, conditionLines, setupLine } from '../../core/labels';
import { CardRecord, ComboRoute, DeckRecord } from '../../core/models';
import { checkRoute } from '../../core/route-check';
import { sourceUrlProblem } from '../../core/schemas';
import { StepNavigator } from '../../core/step-navigator';
import { BoardPreview } from '../../shared/board-preview';
import { CardTile } from '../../shared/card-tile';
import { hasExternalOpener } from '../../shared/platform-hooks';
import { FlowView } from './flow-view';
import { StepView } from './step-view';

export type ViewerMode = 'flow' | 'steps';

/**
 * The one combo player (spec §6.2): conditions, end board, details and both viewing modes
 * sharing one current step. Used by the Combo page and for AI candidates (CR-004 G25-2).
 */
@Component({
  selector: 'app-combo-viewer',
  imports: [BoardPreview, CardTile, FlowView, StepView],
  templateUrl: './combo-viewer.html',
  styleUrl: './combo-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ComboViewer {
  private readonly cardNames = inject(CardNamesService);
  readonly route = input.required<ComboRoute>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly backLink = input<string[]>(['/combos']);
  /** CR-008: the deck the route is checked against; with it the player shows the end-board picture and the per-step records. */
  readonly deck = input<DeckRecord | null>(null);
  /** Owned by the page, so the chosen mode survives loading another route. */
  readonly mode = model<ViewerMode>('flow');

  private readonly endBoard = viewChild<ElementRef<HTMLElement>>('endBoard');

  protected readonly statusLabel = VERIFICATION_LABEL;
  /** Desktop app: the source link opens in the system browser, not a new tab. */
  protected readonly systemBrowser = hasExternalOpener();
  /** One shared step state for both modes (spec §6.2). */
  protected readonly navigator = new StepNavigator();

  protected readonly name = (id: number) => this.cardNames.labelOf(id, this.cards().get(id));
  /** One simulation of the route (the same one the data check runs). Null without a deck or without card moves. */
  private readonly check = computed(() => {
    const deck = this.deck();
    const route = this.route();
    return deck && route.steps.some((s) => s.moves?.length) ? checkRoute(route, deck, { cards: this.cards() }) : null;
  });
  protected readonly states = computed(() => this.check()?.rules?.steps ?? []);
  /** G51: the end board from the state after the last step. */
  protected readonly snapshot = computed<BoardSnapshot | null>(() => {
    const check = this.check();
    const deck = this.deck();
    return check && deck ? endSnapshot(this.route(), deck, this.cards(), check) : null;
  });
  protected readonly conditions = computed(() => conditionLines(this.route(), this.name));
  protected readonly setup = computed(() => setupLine(this.route()));
  protected readonly sourceHref = computed(() => {
    const url = this.route().source?.url;
    if (!url || sourceUrlProblem(url)) return null;
    const t = this.route().source?.timeSeconds;
    if (!t) return url;
    const u = new URL(url);
    u.searchParams.set('t', String(t));
    return u.toString();
  });

  constructor() {
    // A different route starts at its first step; re-rendering the same route keeps the step.
    let lastId: string | undefined;
    effect(() => {
      const route = this.route();
      untracked(() => {
        if (route.id !== lastId) this.navigator.reset(route.steps.length);
        lastId = route.id;
      });
    });
  }

  protected setMode(mode: ViewerMode): void {
    this.mode.set(mode); // the shared navigator is untouched
  }

  protected jumpToEnd(): void {
    this.navigator.last();
    const el = this.endBoard()?.nativeElement;
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus();
  }

  /** ← / → change steps in mode B, except while typing in a form field (F08). */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.mode() !== 'steps' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
    if (event.key === 'ArrowRight') this.navigator.next();
    else if (event.key === 'ArrowLeft') this.navigator.prev();
    else return;
    event.preventDefault();
  }
}
