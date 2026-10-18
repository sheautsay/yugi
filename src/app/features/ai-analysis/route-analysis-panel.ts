import { ChangeDetectionStrategy, Component, computed, input, output, inject } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { INTERRUPTION_BASIS_LABEL, START_KIND_LABEL, STATUS_LABEL, evaluateRoute, handText, interruptionText } from '../../core/ai/evaluate';
import { analysisLevel } from '../../core/analysis-level';
import { deckFingerprint } from '../../core/deck';
import { ANALYSIS_LEVEL_LABEL, ANALYSIS_LEVEL_NOTE, PROVIDER_LABEL } from '../../core/labels';
import { AnalysisLevel, CardCount, CardRecord, ComboRoute, DeckRecord } from '../../core/models';
import { checkRoute } from '../../core/route-check';
import { localDateTime } from '../../core/time';

const LEVELS: AnalysisLevel[] = ['ai-candidate', 'data-checked', 'engine-verified', 'md-confirmed'];

/** CR-004 G23/G24: trust levels, the live data check and resource use of one AI route. */
@Component({
  selector: 'app-route-analysis-panel',
  templateUrl: './route-analysis-panel.html',
  styleUrl: './route-analysis-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteAnalysisPanel {
  private readonly cardNames = inject(CardNamesService);
  readonly route = input.required<ComboRoute>();
  /** The analysed deck as it is now; null when it was deleted. */
  readonly deck = input.required<DeckRecord | null>();
  readonly cards = input.required<Map<number, CardRecord>>();
  readonly busy = input(false);
  readonly recheck = output<void>();

  protected readonly levels = LEVELS;
  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly time = localDateTime;
  protected readonly levelLabel = ANALYSIS_LEVEL_LABEL;
  protected readonly levelNote = ANALYSIS_LEVEL_NOTE;

  protected readonly name = (id: number) => {
    const card = this.cards().get(id);
    return card ? this.cardNames.labelOf(id, card) : `ID ${id}`;
  };
  protected readonly check = computed(() => {
    const deck = this.deck();
    return deck ? checkRoute(this.route(), deck, { cards: this.cards(), name: this.name }) : null;
  });
  protected readonly level = computed(() => analysisLevel(this.route(), this.deck(), { cards: this.cards(), name: this.name }) ?? 'ai-candidate');
  /** CR-006 G37: the simulated end board and which interruptions really work. */
  protected readonly evaluation = computed(() => {
    const deck = this.deck();
    const check = this.check();
    return deck && check ? evaluateRoute(this.route(), deck, this.cards(), check, this.name) : null;
  });
  protected readonly startKindLabel = START_KIND_LABEL;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly basisLabel = INTERRUPTION_BASIS_LABEL;
  protected readonly handText = handText;
  protected readonly interruptionText = interruptionText;
  /** Final monsters with their zone when known. */
  protected readonly finalMonsters = computed(() => {
    const board = this.check()?.rules?.board;
    if (board) return board.monsters.map((m) => `${this.name(m.cardId)}${m.slot ? `（${m.slot}）` : ''}`);
    return (this.evaluation()?.finalMonsters ?? []).map((id) => this.name(id));
  });
  protected readonly currentFingerprint = computed(() => {
    const deck = this.deck();
    return deck ? deckFingerprint(deck) : null;
  });
  protected readonly deckChanged = computed(() => {
    const a = this.route().analysis;
    return !!a && this.currentFingerprint() !== null && a.deckFingerprint !== this.currentFingerprint();
  });

  protected reached(level: AnalysisLevel): boolean {
    const current = this.level();
    if (level === 'engine-verified') return false;
    if (level === 'md-confirmed') return current === 'md-confirmed';
    if (level === 'data-checked') return current === 'data-checked' || (current === 'md-confirmed' && !!this.check()?.passed);
    return true;
  }

  protected list(rows: CardCount[]): string {
    return rows.length ? rows.map((r) => `${this.name(r.cardId)}${r.count > 1 ? `×${r.count}` : ''}`).join('、') : '無';
  }

  protected total(rows: CardCount[]): number {
    return rows.reduce((s, r) => s + r.count, 0);
  }

  protected toRows(ids: number[]): CardCount[] {
    return [...new Set(ids)].map((cardId) => ({ cardId, count: ids.filter((id) => id === cardId).length }));
  }
}
