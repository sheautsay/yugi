import { malissCards, malissDeck } from '../../testing/ai/maliss-deck.sample';
import { routeAllied, routeFirewall, sampleAnswer } from '../../testing/ai/maliss-routes.sample';
import { RunContext, parseAiOutput, toCandidate } from './ai/analysis-output';
import { STAGED_PROMPT_VERSION } from './ai/staged';
import { prepareComboImport } from './combo';
import { SHARE_PREFIX, canShare, decodeShareCodes, encodeShareCode, looksLikeShareCode, shareCodesToImportJson } from './combo-share';
import { deckFingerprint } from './deck';
import { ComboRoute } from './models';

const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'share', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-18T00:00:00.000Z' };
const route = (r: Parameters<typeof sampleAnswer>[0][number]): ComboRoute => {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
};
const known = new Set([...cards.keys()]);

describe('Combo share code (B6)', () => {
  it('this environment can compress', () => expect(canShare()).toBe(true));

  it('round-trips a Combo through the normal import check, and is much smaller than the JSON', async () => {
    const original = route(routeAllied());
    const code = await encodeShareCode(original);
    expect(code.startsWith(`${SHARE_PREFIX}.`)).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_.-]+$/); // safe to paste into any chat
    expect(code.length).toBeLessThan(JSON.stringify(original).length / 2);

    const converted = await shareCodesToImportJson(code);
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    const prepared = prepareComboImport(converted.json, { knownCardIds: known, existingIds: new Set() });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.items).toHaveLength(1);
    expect(prepared.items[0].route.id).toBe(original.id);
    expect(prepared.items[0].route.steps).toEqual(original.steps);
    expect(prepared.items[0].route.endBoard).toEqual(original.endBoard);
  });

  it('a route marked verified arrives as unverified (the import check never trusts a shared verification)', async () => {
    const verified: ComboRoute = { ...route(routeAllied()), verification: { status: 'verified', verifiedAt: '2026-10-01', verifiedBy: 'someone', evidenceNote: 'played it', deckFingerprint: 'fp1-00000000000000' } };
    const converted = await shareCodesToImportJson(await encodeShareCode(verified));
    if (!converted.ok) throw new Error(converted.error);
    const prepared = prepareComboImport(converted.json, { knownCardIds: known, existingIds: new Set() });
    expect(prepared.ok && prepared.items[0].route.verification.status).toBe('unverified');
  });

  it('several codes pasted together (any whitespace between) become one import; a same-id route is reported as a conflict', async () => {
    const a = route(routeAllied());
    const b = route(routeFirewall());
    const text = `${await encodeShareCode(a)}\n\n  ${await encodeShareCode(b)} `;
    expect(looksLikeShareCode(text)).toBe(true);
    const converted = await shareCodesToImportJson(text);
    if (!converted.ok) throw new Error(converted.error);
    const prepared = prepareComboImport(converted.json, { knownCardIds: known, existingIds: new Set([a.id]) });
    if (!prepared.ok) throw new Error(prepared.errors.join());
    expect(prepared.items.map((i) => i.conflict)).toEqual([true, false]);
  });

  it('a code broken by a chat app (cut, edited, wrong prefix) is refused with a clear reason and nothing is decoded', async () => {
    const code = await encodeShareCode(route(routeAllied()));
    const cut = await decodeShareCodes(code.slice(0, code.length - 20));
    expect(cut.ok).toBe(false);
    const edited = await decodeShareCodes(code.replace(/^(YGOCOMBO1\.[A-Za-z0-9_-]{10})./, '$1Z'));
    expect(edited).toEqual({ ok: false, error: expect.stringContaining('檢查碼不符') });
    expect(await decodeShareCodes('YGOCOMBO2.abc.def')).toEqual({ ok: false, error: expect.stringContaining('格式不正確') });
    expect(await decodeShareCodes('   ')).toEqual({ ok: false, error: expect.stringContaining('沒有找到分享碼') });
    expect((await decodeShareCodes(`${SHARE_PREFIX}.%%%.abcdef`)).ok).toBe(false);
  });

  it('a code that decompresses to something huge is refused instead of exhausting memory', async () => {
    const huge = new TextEncoder().encode('x'.repeat(3 * 1024 * 1024));
    const stream = new CompressionStream('deflate-raw');
    const w = stream.writable.getWriter();
    void w.write(huge).then(() => w.close());
    const bytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { cyrb53 } = await import('./deck');
    const check = cyrb53(payload).toString(36).padStart(6, '0').slice(-6);
    const result = await decodeShareCodes(`${SHARE_PREFIX}.${payload}.${check}`);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('內容過大') });
  });

  it('content that is valid JSON but not a single Combo export is refused', async () => {
    const other = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    const stream = new CompressionStream('deflate-raw');
    const w = stream.writable.getWriter();
    void w.write(other).then(() => w.close());
    const bytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { cyrb53 } = await import('./deck');
    const result = await decodeShareCodes(`${SHARE_PREFIX}.${payload}.${cyrb53(payload).toString(36).padStart(6, '0').slice(-6)}`);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('不是一條 Combo') });
  });
});
