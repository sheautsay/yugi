import { TestBed } from '@angular/core/testing';
import { DB_NAME } from '../db';
import { DEFAULT_AI_SETTINGS } from './ai-settings';
import { AiSettingsService } from './ai-settings.service';
import { BRIDGE_DOWN } from './chatgpt';
import { providerAdapter } from './provider-adapters';
import { AI_PROVIDERS } from './providers';

const settings = { ...DEFAULT_AI_SETTINGS, claudeModel: 'claude-opus-5-5', ollamaModel: ' qwen3 ', chatgptModel: 'gpt-x' };
const ctx = { settings, apiKey: '', chatgpt: BRIDGE_DOWN, chatgptModels: null };

describe('provider adapters (P4)', () => {
  it('each provider names its model, cache key parts and recorded parameters', () => {
    expect(providerAdapter('anthropic').modelOf(settings)).toBe('claude-opus-5-5');
    expect(providerAdapter('anthropic').cacheKeyParts(settings)).toEqual(['claude-opus-5-5', 'high']);
    expect(providerAdapter('ollama').modelOf(settings)).toBe('qwen3');
    expect(providerAdapter('ollama').runParams(settings)).toMatchObject({ temperature: 0 });
    expect(providerAdapter('chatgpt').cacheKeyParts(settings)).toEqual(['gpt-x']);
    expect(providerAdapter('chatgpt').runParams(settings)).toEqual({ timeoutSeconds: settings.timeoutSeconds, store: false, stream: true, structuredOutput: true });
  });

  it('only the Claude API has a price list', () => {
    expect(providerAdapter('anthropic').costUsd('claude-opus-5-5', 1_000_000, 0)).toBe(4);
    expect(providerAdapter('anthropic').costUsd('unknown', 1, 1)).toBeUndefined();
    expect(providerAdapter('ollama').costUsd('x', 1, 1)).toBeUndefined();
    expect(providerAdapter('chatgpt').costUsd('x', 1, 1)).toBeUndefined();
  });

  it('pre-flight reasons come from the provider that is selected', () => {
    expect(providerAdapter('anthropic').preflight(ctx)).toEqual(['請輸入 Claude API Key（只存在目前分頁）']);
    expect(providerAdapter('anthropic').preflight({ ...ctx, apiKey: 'k' })).toEqual([]);
    expect(providerAdapter('ollama').preflight({ ...ctx, settings: { ...settings, ollamaModel: '' } })).toContain('請輸入 Ollama 模型名稱');
    expect(providerAdapter('chatgpt').preflight(ctx)).toHaveLength(1);
    const signedIn = { ...BRIDGE_DOWN, reachable: true, signedIn: true, sharing: true };
    expect(providerAdapter('chatgpt').preflight({ ...ctx, chatgpt: signedIn, chatgptModels: [{ slug: 'gpt-x', displayName: 'X' }] })).toEqual([]);
  });
});

describe('default provider follows the build (P4.5)', () => {
  it('is the first entry of AI_PROVIDERS', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DB_NAME, useValue: `prov-${crypto.randomUUID()}` },
        { provide: AI_PROVIDERS, useValue: ['chatgpt'] },
      ],
    });
    expect(TestBed.inject(AiSettingsService).settings().provider).toBe('chatgpt');
  });

  it('keeps Claude API as the browser default', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `prov-${crypto.randomUUID()}` }] });
    expect(TestBed.inject(AiSettingsService).settings().provider).toBe('anthropic');
  });
});
