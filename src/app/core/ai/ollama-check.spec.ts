// CR-010 / D9 / P0.15: the explicit "check Ollama" action; the analysis pre-flight stays offline (G22-2).
import { TestBed } from '@angular/core/testing';
import { DB_NAME } from '../db';
import { newDeck } from '../deck';
import { AiAnalysisService } from './analysis.service';
import { checkOllama, sameOllamaModel } from './ollama-check';
import { AI_FETCH, FetchLike } from './providers';

const NOW = () => new Date('2026-10-11T00:00:00.000Z');
const cfg = (model: string, baseUrl = 'http://localhost:11434') => ({ baseUrl, model });

function server(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = [];
  const fetchFn: FetchLike = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    const handler = routes[url.pathname];
    if (!handler) throw new TypeError('fetch failed');
    return handler();
  };
  return { fetchFn, calls };
}

const up = (models: string[]) => ({
  '/api/version': () => Response.json({ version: '0.12.3' }),
  '/api/tags': () => Response.json({ models: models.map((name) => ({ name })) }),
});

describe('checkOllama (P0.15)', () => {
  it('ready: service up and the model installed', async () => {
    const { fetchFn, calls } = server(up(['qwen3:8b', 'llama3:latest']));
    const r = await checkOllama(cfg('qwen3:8b'), fetchFn, NOW);
    expect(r).toMatchObject({ state: 'ready', version: '0.12.3', models: ['qwen3:8b', 'llama3:latest'], checkedAt: '2026-10-11T00:00:00.000Z' });
    expect(calls).toEqual(['/api/version', '/api/tags']);
  });

  it('a bare name matches the :latest tag, and tags are not confused with each other', async () => {
    expect(sameOllamaModel('llama3', 'llama3:latest')).toBe(true);
    expect(sameOllamaModel('Llama3:Latest', 'llama3')).toBe(true);
    expect(sameOllamaModel('qwen3', 'qwen3:8b')).toBe(false);
    expect((await checkOllama(cfg('llama3'), server(up(['llama3:latest'])).fetchFn, NOW)).state).toBe('ready');
    expect((await checkOllama(cfg('qwen3'), server(up(['qwen3:8b'])).fetchFn, NOW)).state).toBe('model-missing');
  });

  it('service not running: says so and does not ask for the model list', async () => {
    const { fetchFn, calls } = server({});
    const r = await checkOllama(cfg('qwen3'), fetchFn, NOW);
    expect(r.state).toBe('service-down');
    expect(r.message).toContain('ollama serve');
    expect(calls).toEqual(['/api/version']);
  });

  it('model not downloaded: tells the user the pull command and lists what is installed', async () => {
    const r = await checkOllama(cfg('qwen3'), server(up(['llama3:latest'])).fetchFn, NOW);
    expect(r.state).toBe('model-missing');
    expect(r.message).toContain('ollama pull qwen3');
    expect(r.message).toContain('llama3:latest');
  });

  it('no model name: offers the installed ones; nothing installed: asks to pull one', async () => {
    const some = await checkOllama(cfg('  '), server(up(['llama3:latest'])).fetchFn, NOW);
    expect(some.state).toBe('no-model-name');
    expect(some.models).toEqual(['llama3:latest']);
    const none = await checkOllama(cfg(''), server(up([])).fetchFn, NOW);
    expect(none.state).toBe('no-model-name');
    expect(none.message).toContain('ollama pull');
  });

  it('only a model server on this computer is contacted', async () => {
    const { fetchFn, calls } = server(up(['x']));
    for (const url of ['http://example.com:11434', 'http://192.168.0.5:11434', 'ftp://localhost', 'not a url']) {
      expect((await checkOllama(cfg('x', url), fetchFn, NOW)).state).toBe('bad-url');
    }
    expect(calls).toEqual([]);
  });

  it('a server that answers but is not Ollama, or fails listing, is an error — not "ready"', async () => {
    expect((await checkOllama(cfg('x'), server({ '/api/version': () => new Response('nope', { status: 404 }) }).fetchFn, NOW)).state).toBe('error');
    expect((await checkOllama(cfg('x'), server({ '/api/version': () => Response.json({}), '/api/tags': () => new Response('', { status: 500 }) }).fetchFn, NOW)).state).toBe('error');
    expect((await checkOllama(cfg('x'), server({ '/api/version': () => Response.json({}), '/api/tags': () => new Response('not json', { status: 200 }) }).fetchFn, NOW)).state).toBe('error');
  });
});

describe('AiAnalysisService (G22-2 unchanged)', () => {
  function setup(fetchFn: FetchLike) {
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `ol-${crypto.randomUUID()}` }, { provide: AI_FETCH, useValue: fetchFn }] });
    return TestBed.inject(AiAnalysisService);
  }

  it('the pre-flight never contacts Ollama; only the explicit check does, and it records the result', async () => {
    const { fetchFn, calls } = server(up(['qwen3:8b']));
    const ai = setup(fetchFn);
    await ai.ready;
    await ai.updateSettings({ provider: 'ollama', ollamaModel: 'qwen3:8b' });
    const reasons = await ai.preflight(newDeck('d', '2026-10-11T00:00:00.000Z', 'd1'), new Map());
    expect(Array.isArray(reasons)).toBe(true);
    expect(calls).toEqual([]);
    expect(ai.ollamaCheck()).toBeNull();

    const result = await ai.checkOllama();
    expect(result.state).toBe('ready');
    expect(ai.ollamaCheck()).toBe(result);
    expect(calls).toEqual(['/api/version', '/api/tags']);
  });
});
