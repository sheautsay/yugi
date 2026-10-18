import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { Router, RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { comboCardIds, newCombo, newStep, renumber, routeContentChanged, validateCombo } from '../../core/combo';
import { ComboRepository } from '../../core/combo-repository';
import { deckFingerprint } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { ACTION_LABEL, VERIFICATION_LABEL } from '../../core/labels';
import { ACTION_TYPES, CardCount, CardRecord, ComboRoute, DeckRecord, RouteVerification } from '../../core/models';
import { localDate } from '../../core/time';
import { CardIdList } from '../../shared/card-id-list';
import { CardSearch } from '../../shared/card-search';

@Component({
  selector: 'app-combo-edit-page',
  imports: [RouterLink, CardIdList, CardSearch],
  templateUrl: './combo-edit-page.html',
  styleUrl: './combo-edit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboEditPage {
  private readonly repo = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);
  private readonly deckRepo = inject(DeckRepository);
  private readonly router = inject(Router);

  /** Route parameter; absent on /combos/new. */
  readonly comboId = input<string>();

  protected readonly actionTypes = ACTION_TYPES;
  protected readonly actionLabel = ACTION_LABEL;
  protected readonly statusLabel = VERIFICATION_LABEL;
  protected readonly statuses: RouteVerification[] = ['draft', 'unverified', 'verified', 'invalidated'];
  protected readonly noRows: CardCount[] = [];
  protected readonly cardNames = inject(CardNamesService);
  protected readonly date = localDate;

  protected readonly draft = signal<ComboRoute | null>(null);
  protected readonly saved = signal<ComboRoute | null>(null);
  protected readonly notFound = signal(false);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly decks = signal<DeckRecord[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly message = signal('');
  protected readonly addingEndBoard = signal(false);

  protected readonly validation = computed(() => {
    const draft = this.draft();
    return draft ? validateCombo(draft, { knownCardIds: new Set(this.cards().keys()) }) : null;
  });
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  protected readonly fingerprintDeck = computed(() => {
    const fp = this.draft()?.verification.deckFingerprint;
    return this.decks().find((d) => deckFingerprint(d) === fp);
  });

  constructor() {
    effect(() => void this.load(this.comboId()));
  }

  private async load(id: string | undefined): Promise<void> {
    this.errors.set([]);
    const carried = (history.state as { savedMessage?: unknown } | null)?.savedMessage;
    this.message.set(typeof carried === 'string' ? carried : '');
    this.decks.set(await this.deckRepo.list());
    const route = id ? await this.repo.get(id) : newCombo();
    this.notFound.set(!route);
    this.saved.set(id && route ? route : null);
    this.draft.set(route ? structuredClone(route) : null);
    if (route) this.cards.set(await this.cardData.getMany(comboCardIds(route)));
  }

  /** In-place edits of the draft object followed by a new reference so computed state updates. */
  protected touch(): void {
    this.draft.update((d) => (d ? { ...d } : d));
  }

  protected remember(card: CardRecord): void {
    this.cards.update((m) => new Map(m).set(card.cardId, card));
  }

  protected opt(value: string): string | undefined {
    return value.trim() === '' ? undefined : value;
  }

  protected int(value: string, fallback: number): number {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  protected optInt(value: string): number | undefined {
    return value.trim() === '' ? undefined : this.int(value, 0);
  }

  protected setSource(d: ComboRoute, patch: Partial<NonNullable<ComboRoute['source']>>): void {
    const source = { ...d.source, ...patch };
    d.source = Object.values(source).some((v) => v !== undefined) ? source : undefined;
    this.touch();
  }

  protected addClause(d: ComboRoute): void {
    d.conditions.handAllOf = [...d.conditions.handAllOf, { anyOf: [], count: 1 }];
    this.touch();
  }

  protected removeClause(d: ComboRoute, index: number): void {
    d.conditions.handAllOf = d.conditions.handAllOf.filter((_, i) => i !== index);
    this.touch();
  }

  protected addStep(d: ComboRoute): void {
    d.steps = renumber([...d.steps, newStep(d.steps.length + 1)]);
    this.touch();
  }

  protected removeStep(d: ComboRoute, index: number): void {
    if (!confirm(`確定要刪除第 ${index + 1} 步嗎？`)) return;
    d.steps = renumber(d.steps.filter((_, i) => i !== index));
    this.touch();
  }

  protected moveStep(d: ComboRoute, index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= d.steps.length) return;
    const steps = [...d.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    d.steps = renumber(steps);
    this.touch();
  }

  protected addEndBoard(d: ComboRoute, card: CardRecord): void {
    this.remember(card);
    d.endBoard = [...d.endBoard, { cardId: card.cardId, zone: '場上', count: 1 }];
    this.addingEndBoard.set(false);
    this.touch();
  }

  protected removeEndBoard(d: ComboRoute, index: number): void {
    d.endBoard = d.endBoard.filter((_, i) => i !== index);
    this.touch();
  }

  protected setStatus(d: ComboRoute, status: RouteVerification): void {
    d.verification = { ...d.verification, status };
    this.touch();
  }

  protected useDeckForVerification(d: ComboRoute, deckId: string): void {
    const deck = this.decks().find((x) => x.id === deckId);
    d.verification = { ...d.verification, deckFingerprint: deck ? deckFingerprint(deck) : undefined };
    this.touch();
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;
    const saved = this.saved();
    const result = validateCombo(draft, { knownCardIds: new Set(this.cards().keys()) });
    const errors = [...result.errors];
    if (
      saved?.verification.status === 'verified' &&
      draft.verification.status === 'verified' &&
      routeContentChanged(saved, draft) &&
      saved.verification.verifiedAt === draft.verification.verifiedAt &&
      saved.verification.evidenceNote === draft.verification.evidenceNote
    ) {
      errors.push('已驗證路線的條件、步驟或終場已變更：請更新實測日期與證據，或把狀態改為「未驗證」。');
    }
    this.errors.set(errors);
    if (errors.length) return;

    const next: ComboRoute = { ...result.route!, version: saved ? saved.version + 1 : 1, updatedAt: new Date().toISOString() };
    await this.repo.save(next);
    this.saved.set(next);
    this.draft.set(structuredClone(next));
    const savedMessage = `已儲存（版本 ${next.version}）。`;
    this.message.set(savedMessage);
    // A new route moves to its edit URL, which recreates this page; carry the confirmation over.
    if (!saved) await this.router.navigate(['/combos', next.id, 'edit'], { replaceUrl: true, state: { savedMessage } });
  }

  protected discard(): void {
    const saved = this.saved();
    this.draft.set(saved ? structuredClone(saved) : newCombo());
    this.errors.set([]);
    this.message.set('已放棄未儲存的變更。');
  }

  protected async remove(): Promise<void> {
    const saved = this.saved();
    if (!saved || !confirm(`確定要刪除 Combo「${saved.name}」嗎？此動作無法復原。`)) return;
    await this.repo.delete(saved.id);
    await this.router.navigate(['/combos']);
  }
}
