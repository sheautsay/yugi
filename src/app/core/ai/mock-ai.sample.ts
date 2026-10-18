/**
 * TEST DATA ONLY — mocked AI responses for unit and E2E tests (CR-004 G27-3: automated tests never
 * call a real or paid AI service). The routes are structurally consistent placeholders built
 * from whatever card IDs the test passes in; they are NOT real combos and NOT model output.
 * Excluded from the app build (`*.sample.ts`).
 */

export interface MockIds {
  starter: number;
  searched: number;
  extender: number;
  filler: number;
  link: number;
  link2: number;
  /** A card ID that is not in the deck. */
  outsider: number;
}

/** Route 1 is consistent with a deck holding these IDs; route 2 breaks several data rules. */
export function mockAiOutput(ids: MockIds, options: { routes?: 1 | 2 } = {}): Record<string, unknown> {
  const good = {
    name: '單卡起手：測試路線（mock）',
    handCardIds: [ids.starter],
    starterCardIds: [ids.starter],
    requiredInMain: [{ cardId: ids.searched, count: 1 }],
    requiredInExtra: [{ cardId: ids.link, count: 1 }],
    preconditions: ['先攻、雙方空場、無干擾（mock）'],
    steps: [
      step('normal-summon', '通常召喚起手卡', [ids.starter], [], [], [{ cardId: ids.starter, from: 'hand', to: 'field' }]),
      step('search', '起手卡效果檢索', [ids.starter], [ids.searched], [], [{ cardId: ids.searched, from: 'deck', to: 'hand' }]),
      step('special-summon', '特殊召喚檢索到的卡', [ids.searched], [], [], [{ cardId: ids.searched, from: 'hand', to: 'field' }]),
      step('link-summon', '以兩張怪獸連結召喚', [ids.link], [], [ids.starter, ids.searched], [
        { cardId: ids.starter, from: 'field', to: 'gy' },
        { cardId: ids.searched, from: 'field', to: 'gy' },
        { cardId: ids.link, from: 'extra', to: 'field' },
      ]),
    ],
    endBoard: [{ cardId: ids.link, zone: 'field', count: 1, note: '終場（mock）' }],
    pros: ['只需要一張起手卡（mock）'],
    cons: ['終場只有一張怪獸（mock）'],
    // Not part of the schema: a model claiming verification must be ignored.
    verification: { status: 'verified', verifiedBy: 'AI' },
  };
  const bad = {
    name: '雙卡起手：不一致的路線（mock）',
    handCardIds: [ids.extender, ids.filler],
    starterCardIds: [ids.extender, ids.filler],
    requiredInMain: [],
    requiredInExtra: [{ cardId: ids.link2, count: 1 }],
    preconditions: [],
    steps: [
      step('link-summon', '用不在場上的素材連結召喚', [ids.link2], [], [ids.extender], [
        { cardId: ids.extender, from: 'field', to: 'gy' },
        { cardId: ids.link2, from: 'extra', to: 'field' },
      ]),
      step('special-summon', '特殊召喚牌組外的卡', [ids.outsider], [], [], [{ cardId: ids.outsider, from: 'deck', to: 'field' }]),
    ],
    endBoard: [
      { cardId: ids.link2, zone: 'field', count: 1, note: '' },
      { cardId: ids.link, zone: 'field', count: 1, note: '' },
    ],
    pros: [],
    cons: ['mock：故意不一致'],
  };
  return {
    summary: '測試用的分析摘要（mock，不是真正的 AI 輸出）',
    starters: [
      { cardIds: [ids.starter], kind: 'single', description: '單卡起手（mock）' },
      // Mislabelled on purpose: two cards are a multi-card starter whatever the model says.
      { cardIds: [ids.extender, ids.filler], kind: 'single', description: '雙卡起手（mock）' },
      { cardIds: [ids.outsider], kind: 'single', description: '牌組外的卡（mock）' },
    ],
    extenders: [{ cardId: ids.extender, requires: '場上有一隻怪獸（mock）', description: '延伸（mock）' }],
    routes: options.routes === 1 ? [good] : [good, bad],
  };
}

function step(actionType: string, title: string, actors: number[], targets: number[], materials: number[], moves: Array<{ cardId: number; from: string; to: string }>) {
  return {
    actionType,
    title,
    description: `${title}（mock 步驟說明）`,
    actorCardIds: actors,
    targetCardIds: targets,
    materialCardIds: materials,
    cost: '',
    effect: '',
    result: '',
    uncertainty: '',
    moves,
  };
}

/** Server-sent events in the shape the Claude Messages API streams. */
export function anthropicSse(text: string, options: { model?: string; stopReason?: string; inputTokens?: number; outputTokens?: number } = {}): string {
  const model = options.model ?? 'claude-opus-5-5';
  const event = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  const chunks = text.match(/[\s\S]{1,400}/g) ?? [''];
  return [
    event('message_start', {
      type: 'message_start',
      message: { id: 'msg_mock', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: options.inputTokens ?? 12000, output_tokens: 1 } },
    }),
    event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ...chunks.map((t) => event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
    event('content_block_stop', { type: 'content_block_stop', index: 0 }),
    event('message_delta', { type: 'message_delta', delta: { stop_reason: options.stopReason ?? 'end_turn', stop_sequence: null }, usage: { output_tokens: options.outputTokens ?? 3000 } }),
    event('message_stop', { type: 'message_stop' }),
  ].join('');
}

/** Server-sent events in the shape the OpenAI Responses API streams (as relayed by the ChatGPT bridge). */
export function responsesSse(text: string, options: { model?: string; end?: 'completed' | 'failed' | 'incomplete' | 'cut'; errorCode?: string } = {}): string {
  const event = (data: Record<string, unknown>) => `event: ${data['type']}\ndata: ${JSON.stringify(data)}\n\n`;
  const chunks = text.match(/[\s\S]{1,400}/g) ?? [];
  const end = options.end ?? 'completed';
  const model = options.model ?? 'gpt-mock';
  return [
    event({ type: 'response.created', response: { id: 'resp_mock', model } }),
    ...chunks.map((delta) => event({ type: 'response.output_text.delta', delta })),
    end === 'completed' ? event({ type: 'response.completed', response: { id: 'resp_mock', model, usage: { input_tokens: 15000, output_tokens: 3500 } } }) : '',
    end === 'failed' ? event({ type: 'response.failed', response: { id: 'resp_mock', error: { code: options.errorCode ?? 'subscription_sharing_usage_limit_exceeded', message: 'mock failure' } } }) : '',
    end === 'incomplete' ? event({ type: 'response.incomplete', response: { id: 'resp_mock', incomplete_details: { reason: 'max_output_tokens' } } }) : '',
  ].join('');
}

/** Newline-delimited JSON in the shape Ollama's /api/chat streams. */
export function ollamaNdjson(text: string, options: { model?: string; doneReason?: string } = {}): string {
  const model = options.model ?? 'mock-model';
  const chunks = text.match(/[\s\S]{1,400}/g) ?? [''];
  return [
    ...chunks.map((t) => JSON.stringify({ model, message: { role: 'assistant', content: t }, done: false })),
    JSON.stringify({ model, message: { role: 'assistant', content: '' }, done: true, done_reason: options.doneReason ?? 'stop', prompt_eval_count: 9000, eval_count: 2500 }),
  ].join('\n');
}
