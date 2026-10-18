// CR-011: a model refusal arrives on the Responses stream as response.refusal.* events with no output text.
// It must be reported as a refusal — not as "the answer is not valid JSON".
import { AI_OUTPUT_JSON_SCHEMA } from './analysis-output';
import { callChatGpt } from './chatgpt';
import { mockAiOutput, responsesSse } from '../../../testing/ai/mock-ai.sample';
import { AiError, AiRequest, FetchLike } from './providers';
import { IDS } from '../../../testing/ai/test-deck.sample';

const request: AiRequest = { system: 'SYS', user: 'USER', schema: AI_OUTPUT_JSON_SCHEMA, maxOutputTokens: 32000 };
const GOOD = JSON.stringify(mockAiOutput(IDS));
const event = (e: Record<string, unknown>) => `event: ${e['type']}\ndata: ${JSON.stringify(e)}\n\n`;
const stream = (...events: Array<Record<string, unknown>>) => events.map(event).join('');
const COMPLETED = { type: 'response.completed', response: { model: 'gpt-a', usage: { input_tokens: 10, output_tokens: 2 } } };

const run = (body: string) => {
  const fetch: FetchLike = async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  return callChatGpt({ model: 'gpt-a' }, request, { signal: new AbortController().signal, fetch });
};

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof AiError ? e.code : `other: ${String(e)}`;
  }
}

describe('ChatGPT stream: model refusal', () => {
  it('refusal deltas with no text → a refusal error', async () => {
    const body = stream({ type: 'response.refusal.delta', delta: '我無法' }, { type: 'response.refusal.delta', delta: '協助。' }, COMPLETED);
    expect(await code(run(body))).toBe('refusal');
  });

  it('a refusal.done event alone is enough', async () => {
    expect(await code(run(stream({ type: 'response.refusal.done', refusal: '無法協助' }, COMPLETED)))).toBe('refusal');
  });

  it('a normal answer is unaffected, even if a stray refusal event comes with it', async () => {
    const result = await run(responsesSse(GOOD, { model: 'gpt-a' }));
    expect(result.text).toBe(GOOD);
    const mixed = responsesSse(GOOD, { model: 'gpt-a' }).replace('event: response.completed', `${event({ type: 'response.refusal.delta', delta: 'x' })}event: response.completed`);
    expect((await run(mixed)).text).toBe(GOOD);
  });

  it('an empty answer without any refusal is still not a success text (left to the output check)', async () => {
    const result = await run(stream(COMPLETED));
    expect(result.text).toBe('');
  });

  it('a stream cut before response.completed is a network error, not a refusal', async () => {
    expect(await code(run(stream({ type: 'response.refusal.delta', delta: 'x' })))).toBe('network');
  });
});
