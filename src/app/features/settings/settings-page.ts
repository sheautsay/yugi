import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AiAnalysisService } from '../../core/ai/analysis.service';
import { AutoBackupService } from '../../core/auto-backup.service';
import { ConflictStrategy, UserData, parseBackup, planRestore } from '../../core/backup';
import { BackupSettings } from '../../core/backup-settings';
import { BackupService } from '../../core/backup.service';
import { CardDataService, CardNote, SyncInfo } from '../../core/card-data.service';
import { CARD_LANGUAGES, CARD_LANGUAGE_LABEL, CardLanguage, CoverageStats } from '../../core/card-names';
import { CardNamesService } from '../../core/card-names.service';
import { inPool } from '../../core/card-search';
import { CardImageService } from '../../core/card-image.service';
import { DB_VERSION } from '../../core/db';
import { CardPool } from '../../core/models';
import { cardNoteSchema, issues } from '../../core/schemas';
import { SettingsService } from '../../core/settings.service';
import { localDate, localDateTime } from '../../core/time';
import { UserDataService } from '../../core/user-data.service';
import { RouterLink } from '@angular/router';
import { CurrentDeckService } from '../../core/current-deck.service';
import { BattleSettingsService } from '../../core/battle-settings.service';
import { CaptureShortcutService } from '../../shared/recognition/game-capture.service';
import { TEXT } from '../../core/texts';
import { APP_VERSION } from '../../core/version';
import { openExternal } from '../../shared/open-external';
import { canCaptureGame, focusApp, hasExternalOpener } from '../../shared/platform-hooks';
import { saveTextFile } from '../../shared/save-file';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly cardData = inject(CardDataService);
  private readonly images = inject(CardImageService);
  private readonly userData = inject(UserDataService);
  private readonly backups = inject(BackupService);
  protected readonly ai = inject(AiAnalysisService);
  protected readonly current = inject(CurrentDeckService);
  protected readonly version = APP_VERSION;
  /** Inside the Windows app (the host opens links in the system browser). */
  protected readonly desktop = hasExternalOpener();
  protected readonly t = TEXT;
  protected readonly battleText = TEXT.battle;
  protected readonly battle = inject(BattleSettingsService);
  /** B4 (desktop): the capture shortcut and the remembered hand layouts of the game window. */
  protected readonly canCapture = canCaptureGame();
  protected readonly captureShortcut = inject(CaptureShortcutService);
  protected readonly shortcutDraft = signal<string | null>(null);
  protected readonly shortcutError = signal('');
  protected readonly gameLayoutSizes = computed(() =>
    ([5, 6] as const)
      .filter((size) => this.battle.gameLayouts()[size])
      .map((size) => `${size} 張`)
      .join('、'),
  );

  protected async applyShortcut(): Promise<void> {
    const draft = this.shortcutDraft();
    if (draft === null) return;
    if (!(await this.battle.setShortcut(draft))) {
      this.shortcutError.set(this.battleText.shortcutInvalid);
      return;
    }
    this.shortcutError.set('');
    this.shortcutDraft.set(null);
  }

  protected async resetGameLayouts(): Promise<void> {
    await this.battle.setGameLayout(5, null);
    await this.battle.setGameLayout(6, null);
  }
  protected readonly chatgptMessage = signal('');
  protected readonly signingIn = signal(false);
  protected readonly autoBackup = inject(AutoBackupService);
  protected readonly appSettings = inject(SettingsService);
  protected readonly cardNames = inject(CardNamesService);

  protected readonly languages = CARD_LANGUAGES;
  protected readonly languageLabel = CARD_LANGUAGE_LABEL;
  protected readonly coverage = signal<CoverageStats | null>(null);
  protected readonly lastNameImport = signal('尚未匯入');
  protected readonly nameErrors = signal<string[]>([]);
  protected readonly nameMessage = signal('');

  protected readonly syncInfo = signal<SyncInfo | null>(null);
  protected readonly remote = signal('');

  protected readonly dbVersion = DB_VERSION;
  protected readonly time = localDateTime;
  protected readonly cardCount = signal<number | null>(null);
  protected readonly imageCount = signal<number | null>(null);
  protected readonly online = signal(navigator.onLine);
  protected readonly message = signal('');
  protected readonly busy = signal(false);

  protected readonly restoreErrors = signal<string[]>([]);
  protected readonly incoming = signal<{ data: UserData; exportedAt: string; fileName: string; cardNotes: CardNote[]; settings?: BackupSettings } | null>(null);
  /** Restore the non-secret settings that came with the backup (CR-010). */
  protected readonly restoreSettings = signal(true);
  protected readonly existing = signal<UserData | null>(null);
  protected readonly strategy = signal<ConflictStrategy>('keep-both');
  protected readonly plan = computed(() => {
    const incoming = this.incoming();
    const existing = this.existing();
    return incoming && existing ? planRestore(incoming.data, existing, this.strategy()) : null;
  });

  constructor() {
    void this.refreshStats();
    void this.autoBackup.refresh();
    void this.ai.refreshChatGpt();
  }

  protected jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }

  // ---- ChatGPT account (same service and flow as the AI analysis page) ----

  protected refreshChatGpt(): Promise<void> {
    return this.ai.refreshChatGpt();
  }

  /** Opens the official OpenAI sign-in in the system browser and waits (up to 5 minutes) for the result. */
  protected async signInChatGpt(): Promise<void> {
    this.chatgptMessage.set('');
    this.signingIn.set(true);
    try {
      openExternal(await this.ai.chatgptSignIn());
      this.chatgptMessage.set('已開啟 OpenAI 官方登入頁，請在瀏覽器完成登入與授權。');
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2000));
        await this.ai.refreshChatGpt();
        const g = this.ai.chatgpt();
        if (g.signedIn || g.lastError || !g.reachable) {
          this.chatgptMessage.set(g.signedIn ? (g.sharing ? '已登入 ChatGPT，並已授權使用你的 ChatGPT 方案額度。' : '已登入 ChatGPT，但沒有授權使用方案額度；請重新登入並同意。') : '');
          focusApp();
          return;
        }
      }
      this.chatgptMessage.set('等待登入逾時，請再按一次「使用 ChatGPT 登入」。');
    } catch (error) {
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.signingIn.set(false);
    }
  }

  /** Another ChatGPT account: sign out, drop this account's registration, then start a new sign-in. */
  protected async switchChatGptAccount(): Promise<void> {
    if (!confirm('切換帳號會登出目前的 ChatGPT 帳號並撤銷此 App 的授權，接著開啟官方登入頁讓你選擇另一個帳號。要繼續嗎？')) return;
    try {
      await this.ai.chatgptSignOut(true);
    } catch (error) {
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
      return;
    }
    await this.signInChatGpt();
  }

  protected async signOutChatGpt(): Promise<void> {
    try {
      const result = await this.ai.chatgptSignOut();
      this.chatgptMessage.set(result.revoked ? '已登出，並已撤銷此 App 的授權。' : `已在本機登出。${result.message ?? ''}`);
    } catch (error) {
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
    }
  }

  private async refreshStats(): Promise<void> {
    this.syncInfo.set(await this.cardData.syncInfo());
    this.cardCount.set(await this.cardData.count());
    this.imageCount.set(await this.images.count());
    this.online.set(navigator.onLine);
    await this.refreshNames();
  }

  /** Coverage is counted over the card pool the user chose (CR-009, G65). */
  private async refreshNames(): Promise<void> {
    const pool = this.appSettings.settings().cardPool;
    const cards = (await this.cardData.allCards()).filter((c) => inPool(c, pool));
    this.coverage.set(this.cardNames.coverageOf(cards));
    const last = await this.cardNames.lastImport();
    this.lastNameImport.set(last ? `${this.time(last.importedAt)}（${last.count} 筆）` : '尚未匯入');
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

  /** Stored on this device only; a reload keeps it (G66). Names already shown update at once. */
  protected async setLanguage(language: CardLanguage): Promise<void> {
    await this.cardNames.setLanguage(language);
    this.nameMessage.set(`卡名顯示已改為：${CARD_LANGUAGE_LABEL[language]}。`);
  }

  /**
   * Explicit user action (G63, G68): the file is checked as a whole before anything is written. On any error the
   * stored table is left exactly as it was, and the message says so.
   */
  protected async importNameFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.nameErrors.set([]);
    const known = new Set((await this.cardData.allCards()).map((c) => c.cardId));
    const outcome = await this.cardNames.importText(await file.text(), known);
    if (outcome.status === 'rejected') {
      this.nameErrors.set(outcome.errors.slice(0, 10));
      this.nameMessage.set('格式錯誤，未改動任何中文名稱資料。');
    } else if (outcome.status === 'failed') {
      this.nameMessage.set(`寫入失敗，未改動任何中文名稱資料：${outcome.error}`);
    } else {
      const unknown = outcome.unknownIds.length ? `；${outcome.unknownIds.length} 筆 ID 不在本機卡片資料庫（同步卡片資料後才會顯示）` : '';
      this.nameMessage.set(`已匯入：寫入 ${outcome.applied} 筆，保留較高等級的既有資料 ${outcome.kept} 筆${unknown}。`);
    }
    await this.refreshNames();
  }

  protected async exportNotes(): Promise<void> {
    const notes = await this.cardData.notes();
    saveTextFile(`ygo-card-notes-${localDate()}.json`, JSON.stringify(notes, null, 2));
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
    const backup = await this.backups.snapshot();
    saveTextFile(`ygo-combo-backup-${localDate()}.json`, JSON.stringify(backup, null, 2));
    this.message.set(`已匯出備份：牌組 ${backup.decks.length}、Combo ${backup.combos.length}、版型 ${backup.layouts.length}（含非機密設定；不含卡圖、卡片快取與任何金鑰）。`);
  }

  /** Preview first; nothing is written until the user confirms (N6). */
  protected async onBackupFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.incoming.set(null);
    this.restoreErrors.set([]);
    if (!file) return;
    await this.previewBackup(await file.text(), file.name);
  }

  /** Desktop: restore from one of the automatic backups. Same preview and confirmation as a chosen file. */
  protected async restoreFromAuto(name: string): Promise<void> {
    this.incoming.set(null);
    this.restoreErrors.set([]);
    try {
      await this.previewBackup(await this.autoBackup.read(name), name);
    } catch (error) {
      this.restoreErrors.set([error instanceof Error ? error.message : String(error)]);
    }
  }

  protected async backupNow(): Promise<void> {
    this.busy.set(true);
    const result = await this.autoBackup.run({ force: true });
    this.busy.set(false);
    this.message.set(result.status === 'created' ? `已建立備份：${result.file}` : result.status === 'failed' ? `備份失敗：${result.error}` : '沒有資料需要備份。');
  }

  private async previewBackup(text: string, fileName: string): Promise<void> {
    const result = parseBackup(text);
    if (!result.ok) {
      this.restoreErrors.set(result.errors);
      return;
    }
    this.existing.set(await this.userData.readAll());
    this.incoming.set({ data: result.data, exportedAt: result.exportedAt, fileName, cardNotes: result.cardNotes ?? [], settings: result.settings });
  }

  protected async confirmRestore(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.busy.set(true);
    try {
      await this.userData.write(plan.writes);
      const incoming = this.incoming();
      if (incoming?.settings && this.restoreSettings()) {
        await this.appSettings.update(incoming.settings.app);
        await this.ai.updateSettings(incoming.settings.ai);
      }
      const notes = incoming?.cardNotes ?? [];
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
