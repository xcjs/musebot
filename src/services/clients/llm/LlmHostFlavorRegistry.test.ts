import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { LlmHostFlavorRegistry } from './LlmHostFlavorRegistry.js';
import { ILlmHost } from './models/ILlmHost.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function host(url: string, isLocal: boolean | null = null): ILlmHost {
  return { url: new URL(url), token: null, isLocal };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlmHostFlavorRegistry', () => {
  let registry: LlmHostFlavorRegistry;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    registry = new LlmHostFlavorRegistry(mockLogger as never);
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('classifies ollama when /api/ps responds 200', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { models: [] }));

    await registry.probeHost(host('http://localhost:11434'));

    expect(registry.resolve(host('http://localhost:11434')).flavor).toBe(LlmHostFlavor.Ollama);
  });

  it('classifies llamacpp-router when /models (non-/v1) responds 200 and /api/ps did not', async (): Promise<void> => {
    fetchMock
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))  // /api/ps
      .mockResolvedValueOnce(mockResponse(200, { models: [] }));           // /models

    await registry.probeHost(host('http://localhost:8080'));

    expect(registry.resolve(host('http://localhost:8080')).flavor).toBe(LlmHostFlavor.LlamaCppRouter);
  });

  it('classifies llamacpp-single when only /props responds 200', async (): Promise<void> => {
    fetchMock
      .mockResolvedValueOnce(new Response('nf', { status: 404 }))   // /api/ps
      .mockResolvedValueOnce(new Response('nf', { status: 404 }))    // /models
      .mockResolvedValueOnce(mockResponse(200, { is_sleeping: false })); // /props

    await registry.probeHost(host('http://localhost:8081'));

    expect(registry.resolve(host('http://localhost:8081')).flavor).toBe(LlmHostFlavor.LlamaCppSingle);
  });

  it('classifies generic when nothing responds 200', async (): Promise<void> => {
    fetchMock.mockResolvedValue(new Response('nf', { status: 404 }));

    await registry.probeHost(host('https://api.openai.com'));

    expect(registry.resolve(host('https://api.openai.com')).flavor).toBe(LlmHostFlavor.Generic);
  });

  it('returns conservative generic+local default for unprobed host', (): void => {
    const resolved = registry.resolve(host('https://api.openai.com'));

    expect(resolved.flavor).toBe(LlmHostFlavor.Generic);
    expect(resolved.isLocal).toBe(true);
  });

  it('explicit isLocal flag wins over auto-detect even when unprobed', (): void => {
    const resolved = registry.resolve(host('https://api.openai.com', false));

    expect(resolved.flavor).toBe(LlmHostFlavor.Generic);
    expect(resolved.isLocal).toBe(false);
  });

  it('auto-detects localhost hostname as local', (): void => {
    expect(registry.resolve(host('http://localhost:11434')).isLocal).toBe(true);
  });
});