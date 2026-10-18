// CR-011: the Windows app offers the ChatGPT account only; the browser build (V1) is unchanged.
import { TestBed } from '@angular/core/testing';
import { AiAnalysisService, DEFAULT_AI_SETTINGS } from '../core/ai/analysis.service';
import { AI_PROVIDERS } from '../core/ai/providers';
import { buildBackup, parseBackup } from '../core/backup';
import { snapshotSettings } from '../core/backup-settings';
import { DB_NAME, openAppDb } from '../core/db';

function setup(providers?: Array<'anthropic' | 'ollama' | 'chatgpt'>, dbName = `pr-${crypto.randomUUID()}`) {
  TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: dbName }, ...(providers ? [{ provide: AI_PROVIDERS, useValue: providers }] : [])] });
  return { ai: TestBed.inject(AiAnalysisService), dbName };
}

describe('CR-011 provider list', () => {
  it('the browser build keeps all three providers and V1 defaults (nothing changes for V1)', async () => {
    const { ai } = setup();
    await ai.ready;
    expect(ai.providers).toEqual(['anthropic', 'ollama', 'chatgpt']);
    expect(ai.settings().provider).toBe(DEFAULT_AI_SETTINGS.provider);
    await ai.updateSettings({ provider: 'ollama' });
    expect(ai.settings().provider).toBe('ollama');
  });

  it('the Windows app starts on the ChatGPT account and cannot be switched to Claude or Ollama', async () => {
    const { ai } = setup(['chatgpt']);
    expect(ai.settings().provider).toBe('chatgpt'); // even before the stored settings are read
    await ai.ready;
    for (const other of ['anthropic', 'ollama'] as const) {
      await ai.updateSettings({ provider: other });
      expect(ai.settings().provider).toBe('chatgpt');
    }
  });

  it('a Claude or Ollama choice stored by V1 is replaced when the stored settings are loaded', async () => {
    const dbName = `pr-${crypto.randomUUID()}`;
    const db = await openAppDb(dbName);
    await db.put('meta', { key: 'aiSettings', value: { ...DEFAULT_AI_SETTINGS, provider: 'anthropic', claudeModel: 'claude-opus-5-5' } });
    db.close();
    const { ai } = setup(['chatgpt'], dbName);
    await ai.ready;
    expect(ai.settings().provider).toBe('chatgpt');
    expect(ai.settings().claudeModel).toBe('claude-opus-5-5'); // the rest of the stored settings is untouched
  });

  it('a V1 backup that selected Claude restores into the Windows app as ChatGPT, and no key is involved', async () => {
    const settings = snapshotSettings({ cardPool: 'master-duel', autoThumbnails: true, cardLanguage: 'zh-TW' }, { ...DEFAULT_AI_SETTINGS, provider: 'anthropic' });
    const parsed = parseBackup(JSON.stringify(buildBackup({ decks: [], combos: [], layouts: [] }, '2026-10-11T00:00:00.000Z', [], settings)));
    expect(parsed.ok).toBe(true);
    const { ai } = setup(['chatgpt']);
    await ai.ready;
    if (parsed.ok) await ai.updateSettings(parsed.settings!.ai);
    expect(ai.settings().provider).toBe('chatgpt');
    expect(ai.apiKey()).toBe('');
  });

  it('the ChatGPT-only app never asks for a Claude key before an analysis (pre-flight)', async () => {
    const { ai } = setup(['chatgpt']);
    await ai.ready;
    const reasons = await ai.preflight({ id: 'd', name: 'd', main: [], extra: [], side: [], version: 1, createdAt: '', updatedAt: '' } as never, new Map());
    expect(reasons.join('；')).not.toContain('Claude');
    expect(reasons.join('；')).not.toContain('Ollama');
  });
});
