import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConflictStrategy, UserData, buildBackup, parseBackup, planRestore } from '../../core/backup';
import { CardDataService, CardNote, SyncInfo } from '../../core/card-data.service';
import { CardImageService } from '../../core/card-image.service';
import { DB_VERSION } from '../../core/db';
import { CardPool } from '../../core/models';
import { cardNoteSchema, issues } from '../../core/schemas';
import { SettingsService } from '../../core/settings.service';
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
  protected readonly appSettings = inject(SettingsService);

  protected readonly syncInfo = signal<SyncInfo | null>(null);
  protected readonly remote = signal('');

  protected readonly dbVersion = DB_VERSION;
  protected readonly cardCount = signal<number | null>(null);
  protected readonly imageCount = signal<number | null>(null);
  protected readonly online = signal(navigator.onLine);
  protected readonly message = signal('');
  protected readonly busy = signal(false);

  protected readonly restoreErrors = signal<string[]>([]);
  protected readonly incoming = signal<{ data: UserData; exportedAt: string; fileName: string; cardNotes: CardNote[] } | null>(null);
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
    this.syncInfo.set(await this.cardData.syncInfo());
    this.cardCount.set(await this.cardData.count());
    this.imageCount.set(await this.images.count());
    this.online.set(navigator.onLine);
  }

  protected async setPool(pool: CardPool): Promise<void> {
    await this.appSettings.update({ cardPool: pool });
    this.message.set(pool === 'all' ? '已切換為全部遊戲王卡片；請按「下載／更新完整卡片資料」取得全部卡片。' : '已切換為 Master Duel 卡池。');
  }

  protected async setAutoThumbnails(on: boolean): Promise<void> {
    await this.appSettings.update({ autoThumbnails: on });
  }

  protected async checkRemote(): Promise<void> {
    const { version, error } = await this.cardData.remoteVersion();
    const same = this.syncInfo()?.dbVersion === version?.version;
    this.remote.set(error ?? `遠端資料版本 ${version!.version}（更新於 ${version!.lastUpdate}）${same ? '，與本機相同' : '，可以更新'}`);
  }

  /** Explicit user action (G17): full card-data sync; `force` re-downloads an unchanged version. */
  protected async syncCards(force = false): Promise<void> {
    this.busy.set(true);
    this.message.set('正在下載完整卡片資料（約 24 MB，請稍候）…');
    const result = await this.cardData.syncAll(this.appSettings.settings().cardPool, { force });
    this.busy.set(false);
    this.message.set(
      result.status === 'failed'
        ? result.error
        : result.status === 'up-to-date'
          ? `卡片資料已是最新版本（${result.info.dbVersion}），未重新下載。`
          : `已同步 ${result.info.count} 張卡片（新增 ${result.added}、更新 ${result.updated}），資料版本 ${result.info.dbVersion}。`,
    );
    await this.refreshStats();
  }

  protected async exportNotes(): Promise<void> {
    const notes = await this.cardData.notes();
    saveTextFile(`ygo-card-notes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(notes, null, 2));
    this.message.set(`已匯出 ${notes.length} 筆卡片標註。`);
  }

  /** Imports zh-TW names / aliases / ban marks the user trusts; nothing is invented by the app. */
  protected async importNotes(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      this.message.set('不是有效的 JSON 檔案，未匯入任何標註。');
      return;
    }
    if (!Array.isArray(raw)) {
      this.message.set('格式錯誤：檔案內容必須是陣列，未匯入任何標註。');
      return;
    }
    const errors: string[] = [];
    const notes = raw.flatMap((n, i) => {
      const r = cardNoteSchema.safeParse(n);
      if (!r.success) errors.push(...issues(r.error).map((e) => `第 ${i + 1} 筆：${e}`));
      return r.success ? [r.data as CardNote] : [];
    });
    if (errors.length) {
      this.message.set(`格式錯誤，未匯入任何標註：${errors.slice(0, 5).join('；')}`);
      return;
    }
    const { applied, missing } = await this.cardData.applyNotes(notes);
    const missingText = missing.length ? `；${missing.length} 張卡不在本機資料庫（請先同步卡片資料）` : '';
    this.message.set(`已套用 ${applied} 筆卡片標註${missingText}。`);
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
    const notes = await this.cardData.notes();
    saveTextFile(`ygo-combo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(data, undefined, notes), null, 2));
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
    this.incoming.set({ data: result.data, exportedAt: result.exportedAt, fileName: file.name, cardNotes: result.cardNotes ?? [] });
  }

  protected async confirmRestore(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.busy.set(true);
    try {
      await this.userData.write(plan.writes);
      const notes = this.incoming()?.cardNotes ?? [];
      const noteResult = notes.length ? await this.cardData.applyNotes(notes) : null;
      const noteText = noteResult
        ? `卡片標註套用 ${noteResult.applied} 筆${noteResult.missing.length ? `（${noteResult.missing.length} 筆需先同步卡片資料再匯入）` : ''}。`
        : '';
      this.message.set(
        noteText +
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
