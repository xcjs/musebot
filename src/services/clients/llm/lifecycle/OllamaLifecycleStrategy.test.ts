import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILlmHost } from '../models/ILlmHost.js';
import { OllamaLifecycleStrategy } from './OllamaLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('OllamaLifecycleStrategy', () => {
  let strategy: OllamaLifecycleStrategy;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    strategy = new OllamaLifecycleStrategy(
      makeHost('http://localhost:11434'),
      'test-model',
      mockLogger as never,
      10);
  });

  it('free() posts keep_alive: 0 to /api/generate', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {}));

    const result = await strategy.free();

    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url as string)).toBe('http://localhost:11434/api/generate');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model', keep_alive: 0 });
  });

  it('sends Authorization header only when token present', async (): Promise<void> => {
    const authed = new OllamaLifecycleStrategy(
      makeHost('http://localhost:11434', 'secret-token'),
      'test-model',
      mockLogger as never,
      10);
    fetchMock.mockResolvedValue(mockResponse(200, {}));

    await authed.free();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('isModelLoaded() returns true when model present in /api/ps', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { models: [{ name: 'test-model' }] }));

    expect(await strategy.isModelLoaded()).toBe(true);
    expect(String(fetchMock.mock.calls[0][0] as string)).toBe('http://localhost:11434/api/ps');
  });

  it('waitForModelUnload() polls /api/ps until model absent, then true', async (): Promise<void> => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, {}))                            // free
      .mockResolvedValueOnce(mockResponse(200, { models: [{ name: 'test-model' }] })) // still loaded
      .mockResolvedValueOnce(mockResponse(200, { models: [] }));               // gone

    const result = await strategy.waitForModelUnload(10);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('getContextWindow() reads *.context_length from /api/show model_info', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      model_info: { 'gemma.context_length': 100000 }
    }));

    expect(await strategy.getContextWindow()).toBe(100000);
  });

  it('hasVisionCapability() true when capabilities includes vision', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { capabilities: ['vision'] }));

    expect(await strategy.hasVisionCapability('test-model')).toBe(true);
  });
});