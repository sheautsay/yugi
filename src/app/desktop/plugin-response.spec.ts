// Regression (found on the installed Win11 app, 2026-10-11): @tauri-apps/plugin-http builds its Response WITHOUT
// headers and defines `headers` afterwards, so blob().type was "" and every card image was rejected.
import { createDesktopFetch, withRealHeaders } from './desktop-fetch';

/** Exactly how plugin-http 2.8 constructs its Response (dist-js/index.js). */
function pluginStyleResponse(bytes: Uint8Array | string, headers: Record<string, string>, status = 200): Response {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const res = new Response(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { status, statusText: 'OK' });
  Object.defineProperty(res, 'headers', { value: new Headers(headers), writable: false });
  return res;
}

describe('plugin-http responses', () => {
  it('reproduces the defect: the plugin-style Response has an empty blob type', async () => {
    const res = pluginStyleResponse(new Uint8Array([0xff, 0xd8, 0xff]), { 'content-type': 'image/jpeg' });
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect((await res.blob()).type).toBe('');
  });

  it('withRealHeaders gives blob() its content type and keeps status, headers and bytes', async () => {
    const res = withRealHeaders(pluginStyleResponse(new Uint8Array([0xff, 0xd8, 0xff]), { 'content-type': 'image/jpeg', 'x-request-id': 'r1' }, 200));
    const blob = await res.blob();
    expect(blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('r1');
  });

  it('keeps error statuses and bodies, and null-body statuses', async () => {
    const err = withRealHeaders(pluginStyleResponse('{"error":{"code":"x"}}', { 'content-type': 'application/json' }, 429));
    expect(err.status).toBe(429);
    expect(await err.json()).toEqual({ error: { code: 'x' } });
    const empty = new Response(null, { status: 204 });
    expect(withRealHeaders(empty).status).toBe(204);
  });

  it('streams are passed through chunk by chunk (SSE progress still arrives before the end)', async () => {
    let push!: (s: string) => void;
    let end!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (s) => controller.enqueue(new TextEncoder().encode(s));
        end = () => controller.close();
      },
    });
    const plugin = new Response(body, { status: 200 });
    Object.defineProperty(plugin, 'headers', { value: new Headers({ 'content-type': 'text/event-stream' }) });
    const res = withRealHeaders(plugin);
    const reader = res.body!.getReader();
    push('data: 1\n\n');
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('data: 1\n\n'); // received before the stream ended
    push('data: 2\n\n');
    end();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('data: 2\n\n');
    expect((await reader.read()).done).toBe(true);
  });

  it('the desktop fetch applies it to every response (image host and bridge)', async () => {
    const fetchImpl = async (input: RequestInfo | URL) =>
      String(input).includes('images.ygoprodeck.com')
        ? pluginStyleResponse(new Uint8Array([1, 2, 3]), { 'content-type': 'image/jpeg' })
        : pluginStyleResponse('{"ok":true}', { 'content-type': 'application/json' });
    const f = createDesktopFetch({ fetch: fetchImpl, invoke: async <T>() => ({ port: 50000, token: 't'.repeat(40) }) as T });
    expect((await (await f('https://images.ygoprodeck.com/images/cards_small/1.jpg')).blob()).type).toBe('image/jpeg');
    expect((await (await f('/chatgpt-bridge/status')).blob()).type).toBe('application/json');
  });
});
