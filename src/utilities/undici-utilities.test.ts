import http from 'node:http';

import { REST } from '@discordjs/rest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Agent, Dispatcher1Wrapper } from 'undici';

import { installUndiciFormDataGlobal } from './undici-utilities.js';

// Fragile by design (undici 8.13.1): this test reconstructs the crashing
// environment via the `Dispatcher1Wrapper` export and the legacy
// `undici.globalDispatcher.1` symbol, both of which are undici version
// details rather than stable API. If a future undici upgrade breaks this
// file at import or lookup, re-derive both from that version's
// lib/global.js and lib/dispatcher/dispatcher1-wrapper.js.

// The crashing environment: musebot's undici (this npm install) seeds the
// legacy global dispatcher slot with a v2 dispatcher wrapped for legacy (v1)
// consumers, while @discordjs/rest's bundled older undici reads that slot
// when no request dispatcher is set (parcel bundles have no Node-internal
// undici to pre-seed it).
const legacyGlobalDispatcher = Symbol.for('undici.globalDispatcher.1');
const globalRecord = globalThis as unknown as Record<symbol, unknown>;
const originalDispatcher = globalRecord[legacyGlobalDispatcher];
const originalFormData = globalThis.FormData;
interface ReceivedBody {
  bytes: number;
  contentType: string | undefined;
}

const received: ReceivedBody[] = [];
const server = http.createServer((req, res): void => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer): void => {
    chunks.push(chunk);
  });
  req.on('end', (): void => {
    const body = Buffer.concat(chunks);
    received.push({ bytes: body.length, contentType: req.headers['content-type'] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: '1', channel_id: '1', content: 'ok' }));
  });
});

let baseUrl = '';

const multipartRequest = {
  body: { content: 'hi' },
  files: [{ name: 'a.png', data: Buffer.from('%PNG'), contentType: 'image/png' }]
};

function createRest(): REST {
  const rest = new REST().setToken('test-token');
  rest.options.api = baseUrl;
  return rest;
}

async function postMultipart(rest: REST): Promise<{ error: Error | null; code?: string }> {
  try {
    await rest.post('/channels/1/messages', multipartRequest);
    return { error: null };
  } catch (error: unknown) {
    const typed = error instanceof Error ? error : new Error('non-error value thrown during multipart post');
    const code = (error as { code?: string }).code;
    return { error: typed, code };
  }
}

describe('installUndiciFormDataGlobal', (): void => {
  beforeAll(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      server.listen(0, '127.0.0.1', (): void => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll((): void => {
    server.close();
  });

  beforeEach((): void => {
    received.length = 0;
    // Recreate the crashing environment: the legacy global dispatcher slot
    // hosts musebot's undici dispatcher (wrapped for legacy consumers) while
    // the global FormData remains Node's built-in one (wrong brand).
    globalRecord[legacyGlobalDispatcher] = new Dispatcher1Wrapper(new Agent());
  });

  afterEach((): void => {
    globalRecord[legacyGlobalDispatcher] = originalDispatcher;
    (globalThis as { FormData: unknown }).FormData = originalFormData;
  });

  it('rejects multipart bodies built from the built-in FormData with a brand-check error', async (): Promise<void> => {
    const outcome = await postMultipart(createRest());

    // The throw happens inside request construction, before any network I/O.
    expect(received).toHaveLength(0);
    expect(outcome.error?.name).toBe('InvalidArgumentError');
    expect(outcome.code).toBe('UND_ERR_INVALID_ARG');
    expect(outcome.error?.message)
      .toContain('body must be a FormData created by this undici package instance');
  });

  it('lets multipart through once musebot\'s undici FormData is installed as the global', async (): Promise<void> => {
    installUndiciFormDataGlobal();

    const outcome = await postMultipart(createRest());

    expect(outcome.error).toBeNull();
    expect(received).toHaveLength(1);
    expect(received[0].contentType).toContain('multipart/form-data');
    expect(received[0].bytes).toBeGreaterThan(0);
  });
});
