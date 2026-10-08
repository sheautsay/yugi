import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { comboCardIds } from '../../core/combo';
import { ComboRepository } from '../../core/combo-repository';
import { displayName } from '../../core/deck';
import { VERIFICATION_LABEL, conditionLines, setupLine } from '../../core/labels';
import { CardRecord, ComboRoute } from '../../core/models';
import { sourceUrlProblem } from '../../core/schemas';
import { StepNavigator } from '../../core/step-navigator';
import { CardTile } from '../../shared/card-tile';
import { FlowView } from './flow-view';
import { StepView } from './step-view';

type Mode = 'flow' | 'steps';

@Component({
  selector: 'app-combo-detail-page',
  imports: [RouterLink, CardTile, FlowView, StepView],
  templateUrl: './combo-detail-page.html',
  styleUrl: './combo-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ComboDetailPage {
  private readonly repo = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);

  readonly comboId = input.required<string>();
  /** Set when opened from an opening-hand query, to offer the way back. */
  readonly deck = input<string>();

  private readonly endBoard = viewChild<ElementRef<HTMLElement>>('endBoard');

  protected readonly statusLabel = VERIFICATION_LABEL;
  /** One shared step state for both modes (spec §6.2). */
  protected readonly navigator = new StepNavigator();
  protected readonly mode = signal<Mode>('flow');
  protected readonly route = signal<ComboRoute | null>(null);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly loaded = signal(false);

  protected readonly name = (id: number) => displayName(this.cards().get(id));
  protected readonly conditions = computed(() => {
    const route = this.route();
    return route ? conditionLines(route, this.name) : [];
  });
  protected readonly setup = computed(() => {
    const route = this.route();
    return route ? setupLine(route) : '';
  });
  protected readonly sourceHref = computed(() => {
    const url = this.route()?.source?.url;
    if (!url || sourceUrlProblem(url)) return null;
    const t = this.route()?.source?.timeSeconds;
    if (!t) return url;
    const u = new URL(url);
    u.searchParams.set('t', String(t));
    return u.toString();
  });
  protected readonly backLink = computed(() => {
    const deck = this.deck();
    return deck ? ['/decks', deck, 'hand'] : ['/combos'];
  });
  protected readonly unknownCards = computed(() => {
    const route = this.route();
    return route ? comboCardIds(route).filter((id) => !this.cards().has(id)) : [];
  });

  constructor() {
    effect(() => void this.load(this.comboId()));
  }

  private async load(id: string): Promise<void> {
    this.loaded.set(false);
    const route = await this.repo.get(id);
    this.route.set(route ?? null);
    this.navigator.reset(route?.steps.length ?? 0);
    if (route) this.cards.set(await this.cardData.getMany(comboCardIds(route)));
    this.loaded.set(true);
  }

  protected setMode(mode: Mode): void {
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
