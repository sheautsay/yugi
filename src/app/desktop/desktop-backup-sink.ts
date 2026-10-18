import type { BackupSink } from '../core/auto-backup.service';
import type { DesktopApis } from './desktop-apis';

export const BACKUP_FOLDER = 'YGO Combo 助手';
export const BACKUP_SUBFOLDER = 'backups';

/**
 * The automatic-backup folder: `<Documents>\YGO Combo 助手\backups`, with Documents taken from Windows (never a
 * hard-coded path). Files are written under a temporary name and renamed, so a crash cannot leave a half-written backup.
 */
export function createDesktopBackupSink(apis: Pick<DesktopApis, 'documentDir' | 'joinPath' | 'mkdir' | 'listNames' | 'readText' | 'writeText' | 'rename' | 'remove'>): BackupSink {
  let dir: Promise<string> | null = null;
  const directory = () => (dir ??= apis.documentDir().then((docs) => apis.joinPath(docs, BACKUP_FOLDER, BACKUP_SUBFOLDER)));
  const inDir = async (name: string) => {
    // File names come from this app only; refuse anything that could leave the folder.
    if (name !== name.replace(/[\\/]|\.\./g, '') || !name) throw new Error('不合法的備份檔名稱');
    return apis.joinPath(await directory(), name);
  };
  return {
    directory,
    list: async () => (await apis.listNames(await directory())).filter((n) => !n.endsWith('.tmp')),
    read: async (name) => apis.readText(await inDir(name)),
    write: async (name, text) => {
      await apis.mkdir(await directory());
      const target = await inDir(name);
      const temp = await inDir(`${name}.tmp`);
      await apis.writeText(temp, text);
      try {
        await apis.rename(temp, target);
      } catch (error) {
        await apis.remove(temp).catch(() => undefined);
        throw error;
      }
    },
    remove: async (name) => apis.remove(await inDir(name)),
  };
}
