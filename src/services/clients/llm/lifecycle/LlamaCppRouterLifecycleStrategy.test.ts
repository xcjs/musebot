import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILlmHost } from '../models/ILlmHost.js';
import { LlamaCppRouterLifecycleStrategy } from './LlamaCppRouterLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlamaCppRouterLifecycleStrategy', () => {
  let strategy: LlamaCppRouterLifecycleStrategy;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    strategy = new LlamaCppRouterLifecycleStrategy(
      makeHost('http://localhost:8080'),
      'test-model',
      mockLogger as never,
      ['vision-model']);
  });

  it('free() posts model to /models/unload', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { success: true }));

    expect(await strategy.free()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url as string)).toBe('http://localhost:8080/models/unload');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model' });
  });

  it('isModelLoaded() true when /models lists status loaded', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      models: [{ model: 'test-model', status: { value: 'loaded' } }]
    }));

    expect(await strategy.isModelLoaded()).toBe(true);
  });

  it('waitForModelUnload() polls /models until status unloaded', async (): Promise<void> => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { success: true }))  // free
      .mockResolvedValueOnce(mockResponse(200, {
        models: [{ model: 'test-model', status: { value: 'loaded' } }]
      }))
      .mockResolvedValueOnce(mockResponse(200, {
        models: [{ model: 'test-model', status: { value: 'unloaded' } }]
      }));

    expect(await strategy.waitForModelUnload(10)).toBe(true);
  });

  it('getContextWindow() always null', async (): Promise<void> => {
    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('hasVisionCapability() true when model in visionModels', async (): Promise<void> => {
    expect(await strategy.hasVisionCapability('vision-model')).toBe(true);
    expect(await strategy.hasVisionCapability('other-model')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});