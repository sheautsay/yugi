import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { ImportItem, comboCardIds, copyCombo, exportCombos, prepareComboImport, validateCombo } from '../../core/combo';
import { ComboRepository } from '../../core/combo-repository';
import { VERIFICATION_LABEL } from '../../core/labels';
import { ComboRoute } from '../../core/models';
import { safeFileName, saveTextFile } from '../../shared/save-file';

type ConflictChoice = 'keep-both' | 'overwrite' | 'skip';

@Component({
  selector: 'app-combo-list-page',
  imports: [RouterLink],
  templateUrl: './combo-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboListPage {
  private readonly repo = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);

  protected readonly statusLabel = VERIFICATION_LABEL;
  protected readonly combos = signal<ComboRoute[]>([]);
  protected readonly message = signal('');
  protected readonly importText = signal('');
  protected readonly importErrors = signal<string[]>([]);
  protected readonly importItems = signal<ImportItem[] | null>(null);
  protected readonly missingCardIds = signal<number[]>([]);
  protected readonly conflictChoice = signal<ConflictChoice>('keep-both');
  protected readonly busy = signal(false);
  protected readonly conflicts = computed(() => this.importItems()?.filter((i) => i.conflict).length ?? 0);

  constructor() {
    void this.reload();
  }

  private async reload(): Promise<void> {
    this.combos.set(await this.repo.list());
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importText.set(await file.text());
    await this.check();
  }

  /** Validates the whole file; nothing is written until the user confirms (N6). */
  protected async check(): Promise<void> {
    this.importItems.set(null);
    this.missingCardIds.set([]);
    const text = this.importText();
    const referenced = this.referencedIds(text);
    const known = await this.cardData.getMany(referenced);
    const result = prepareComboImport(text, { knownCardIds: new Set(known.keys()), existingIds: new Set(this.combos().map((c) => c.id)) });
    if (!result.ok) {
      this.importErrors.set(result.errors);
      this.missingCardIds.set(referenced.filter((id) => !known.has(id)));
      return;
    }
    this.importErrors.set([]);
    this.importItems.set(result.items);
  }

  protected async downloadMissing(): Promise<void> {
    this.busy.set(true);
    const result = await this.cardData.downloadMissing(this.missingCardIds());
    this.busy.set(false);
    this.message.set(result.error ?? (result.unknownIds.length ? `資料來源查無 ID：${result.unknownIds.join('、')}` : `已下載 ${result.added} 張卡片資料，重新檢查中…`));
    await this.check();
  }

  protected async confirmImport(): Promise<void> {
    const items = this.importItems();
    if (!items) return;
    const now = new Date().toISOString();
    const choice = this.conflictChoice();
    const toWrite = items.flatMap(({ route, conflict }) => {
      if (!conflict) return [route];
      if (choice === 'skip') return [];
      if (choice === 'overwrite') return [route];
      return [{ ...route, id: crypto.randomUUID(), name: `${route.name}（匯入）`.slice(0, 120), createdAt: now, updatedAt: now }];
    });
    await this.repo.saveAll(toWrite);
    this.message.set(`已匯入 ${toWrite.length} 條 Combo（略過 ${items.length - toWrite.length} 條）。匯入的路線一律為未驗證或草稿。`);
    this.cancelImport();
    this.importText.set('');
    await this.reload();
  }

  protected cancelImport(): void {
    this.importItems.set(null);
    this.importErrors.set([]);
    this.missingCardIds.set([]);
  }

  protected async copy(route: ComboRoute): Promise<void> {
    await this.repo.save(copyCombo(route));
    this.message.set(`已複製「${route.name}」（複本為草稿，需重新驗證）。`);
    await this.reload();
  }

  protected async remove(route: ComboRoute): Promise<void> {
    if (!confirm(`確定要刪除 Combo「${route.name}」嗎？此動作無法復原。`)) return;
    await this.repo.delete(route.id);
    this.message.set(`已刪除「${route.name}」。`);
    await this.reload();
  }

  protected exportOne(route: ComboRoute): void {
    saveTextFile(`${safeFileName(route.name)}.combo.json`, exportCombos([route]));
  }

  protected exportAll(): void {
    saveTextFile(`ygo-combos-${new Date().toISOString().slice(0, 10)}.json`, exportCombos(this.combos()));
  }

  /** Card IDs used by the routes in the file that are at least structurally valid. */
  private referencedIds(text: string): number[] {
    try {
      const data = JSON.parse(text) as unknown;
      const list = Array.isArray(data) ? data : ((data as { combos?: unknown[] })?.combos ?? [data]);
      return [
        ...new Set(
          list.flatMap((raw) => {
            const route = validateCombo(raw).route;
            return route ? comboCardIds(route) : [];
          }),
        ),
      ];
    } catch {
      return [];
    }
  }
}
