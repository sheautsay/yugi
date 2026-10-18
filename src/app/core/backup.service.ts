import { Injectable, inject } from '@angular/core';
import { AiAnalysisService } from './ai/analysis.service';
import { BackupFile, buildBackup } from './backup';
import { snapshotSettings } from './backup-settings';
import { CardDataService } from './card-data.service';
import { SettingsService } from './settings.service';
import { UserDataService } from './user-data.service';

/** The one place that gathers everything a backup contains (user data, card notes, non-secret settings). */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly userData = inject(UserDataService);
  private readonly cardData = inject(CardDataService);
  private readonly appSettings = inject(SettingsService);
  private readonly ai = inject(AiAnalysisService);

  async snapshot(now?: string): Promise<BackupFile> {
    await Promise.all([this.appSettings.ready, this.ai.ready]);
    const data = await this.userData.readAll();
    const notes = await this.cardData.notes();
    return buildBackup(data, now, notes, snapshotSettings(this.appSettings.settings(), this.ai.settings()));
  }
}
