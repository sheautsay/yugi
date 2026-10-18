import { FetchLike, ollamaUrlProblem } from './providers';

// CR-010 (decision D9, P5): an explicit "is Ollama ready?" check, started by the user. The analysis
// pre-flight (G22-2) is unchanged and still never contacts any service.

export type OllamaState = 'ready' | 'service-down' | 'model-missing' | 'no-model-name' | 'bad-url' | 'error';

export interface OllamaCheck {
  state: OllamaState;
  /** What to tell the user, including the next step. */
  message: string;
  /** Installed model names as the server lists them. */
  models: string[];
  version?: string;
  /** The settings the result is for, so a later change marks it as out of date. */
  baseUrl: string;
  model: string;
  checkedAt: string;
}

const TIMEOUT_MS = 5000;

/** "qwen3" and "qwen3:latest" are the same model to Ollama. */
export function sameOllamaModel(wanted: string, installed: string): boolean {
  const norm = (n: string) => (n.includes(':') ? n : `${n}:latest`).toLowerCase();
  return norm(wanted.trim()) === norm(installed.trim());
}

export async function checkOllama(config: { baseUrl: string; model: string }, fetchFn: FetchLike, now: () => Date = () => new Date()): Promise<OllamaCheck> {
  const base = { baseUrl: config.baseUrl, model: config.model.trim(), checkedAt: now().toISOString(), models: [] as string[] };
  const problem = ollamaUrlProblem(config.baseUrl);
  if (problem) return { ...base, state: 'bad-url', message: problem };

  const get = async (path: string): Promise<Response> => {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    return fetchFn(new URL(path, config.baseUrl).toString(), { method: 'GET', signal });
  };

  let version: string | undefined;
  try {
    const response = await get('/api/version');
    if (!response.ok) return { ...base, state: 'error', message: `Ollama 回應錯誤（${response.status}）：請確認位址是 Ollama 服務。` };
    version = ((await response.json().catch(() => ({}))) as { version?: string }).version;
  } catch {
    return {
      ...base,
      state: 'service-down',
      message: '無法連線到本機 Ollama：請確認已啟動（開啟 Ollama 應用程式，或執行 ollama serve），位址是否正確；若是瀏覽器版，另需允許此網頁的來源（OLLAMA_ORIGINS）。',
    };
  }

  let models: string[];
  try {
    const response = await get('/api/tags');
    if (!response.ok) return { ...base, version, state: 'error', message: `Ollama 無法列出已安裝的模型（${response.status}）。` };
    const body = (await response.json()) as { models?: Array<{ name?: unknown; model?: unknown }> };
    models = (body.models ?? []).map((m) => (typeof m.name === 'string' ? m.name : typeof m.model === 'string' ? m.model : '')).filter(Boolean);
  } catch {
    return { ...base, version, state: 'error', message: 'Ollama 已啟動，但無法讀取模型清單，請稍後再按一次檢查。' };
  }

  if (!base.model) {
    return {
      ...base,
      version,
      models,
      state: 'no-model-name',
      message: models.length ? `Ollama 已啟動。請輸入模型名稱，已安裝：${models.join('、')}` : 'Ollama 已啟動，但尚未下載任何模型：請先執行 ollama pull <模型名稱>。',
    };
  }
  if (!models.some((m) => sameOllamaModel(base.model, m))) {
    return {
      ...base,
      version,
      models,
      state: 'model-missing',
      message: `Ollama 已啟動，但沒有下載「${base.model}」：請執行 ollama pull ${base.model}。${models.length ? `已安裝：${models.join('、')}` : ''}`,
    };
  }
  return { ...base, version, models, state: 'ready', message: `Ollama 就緒（${version ? `版本 ${version}，` : ''}模型「${base.model}」已安裝）。` };
}
