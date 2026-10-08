import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConflictStrategy, UserData, buildBackup, parseBackup, planRestore } from '../../core/backup';
import { CardDataService } from '../../core/card-data.service';
import { CardImageService } from '../../core/card-image.service';
import { DB_VERSION } from '../../core/db';
import { UserDataService } from '../../core/user-data.service';
import { saveTextFile } from '../../shared/save-file';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly cardData = inject(CardDataService);
  private readonly images = inject(CardImageService);
  private readonly userData = inject(UserDataService);

  protected readonly dbVersion = DB_VERSION;
  protected readonly cardCount = signal<number | null>(null);
  protected readonly imageCount = signal<number | null>(null);
  protected readonly online = signal(navigator.onLine);
  protected readonly message = signal('');
  protected readonly busy = signal(false);

  protected readonly restoreErrors = signal<string[]>([]);
  protected readonly incoming = signal<{ data: UserData; exportedAt: string; fileName: string } | null>(null);
  protected readonly existing = signal<UserData | null>(null);
  protected readonly strategy = signal<ConflictStrategy>('keep-both');
  protected readonly plan = computed(() => {
    const incoming = this.incoming();
    const existing = this.existing();
    return incoming && existing ? planRestore(incoming.data, existing, this.strategy()) : null;
  });

  constructor() {
    void this.refreshStats();
  }

  private async refreshStats(): Promise<void> {
    this.cardCount.set(await this.cardData.count());
    this.imageCount.set(await this.images.count());
    this.online.set(navigator.onLine);
  }

  protected async refreshCards(): Promise<void> {
    this.busy.set(true);
    const result = await this.cardData.refreshAll();
    this.busy.set(false);
    this.message.set(result.error ?? `已更新 ${result.added} 張卡片資料${result.unknownIds.length ? `；查無 ${result.unknownIds.length} 個 ID` : ''}。`);
    await this.refreshStats();
  }

  protected async clearImages(): Promise<void> {
    if (!confirm('確定要清除所有已快取的卡圖嗎？之後需重新下載才會顯示卡圖。')) return;
    await this.images.clear();
    this.message.set('已清除卡圖快取。');
    await this.refreshStats();
  }

  protected async exportBackup(): Promise<void> {
    const data = await this.userData.readAll();
    saveTextFile(`ygo-combo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(data), null, 2));
    this.message.set(`已匯出備份：牌組 ${data.decks.length}、Combo ${data.combos.length}、版型 ${data.layouts.length}（不含卡圖與卡片快取）。`);
  }

  /** Preview first; nothing is written until the user confirms (N6). */
  protected async onBackupFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.incoming.set(null);
    this.restoreErrors.set([]);
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      this.restoreErrors.set(result.errors);
      return;
    }
    this.existing.set(await this.userData.readAll());
    this.incoming.set({ data: result.data, exportedAt: result.exportedAt, fileName: file.name });
  }

  protected async confirmRestore(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.busy.set(true);
    try {
      await this.userData.write(plan.writes);
      this.message.set(
        `還原完成：新增 ${plan.added}、覆蓋 ${plan.overwritten}、另存副本 ${plan.copied}、略過 ${plan.skipped}、內容相同 ${plan.unchanged}。` +
          '卡片資料與卡圖不在備份內，請到牌組編輯頁重新下載。',
      );
      this.incoming.set(null);
    } catch {
      this.message.set('還原失敗，未寫入任何資料（整批取消）。請確認瀏覽器儲存空間後再試。');
    } finally {
      this.busy.set(false);
    }
  }

  protected cancelRestore(): void {
    this.incoming.set(null);
    this.restoreErrors.set([]);
  }
}
