import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILlmHost } from '../models/ILlmHost.js';
import { LlamaCppSingleLifecycleStrategy } from './LlamaCppSingleLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlamaCppSingleLifecycleStrategy', () => {
  let strategy: LlamaCppSingleLifecycleStrategy;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    strategy = new LlamaCppSingleLifecycleStrategy(
      makeHost('http://localhost:8080'),
      'test-model',
      mockLogger as never);
  });

  it('free() resolves true without any fetch call', async (): Promise<void> => {
    expect(await strategy.free()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isModelLoaded() always returns false without fetch', async (): Promise<void> => {
    expect(await strategy.isModelLoaded()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waitForModelUnload() polls /props until is_sleeping true, without calling free()', async (): Promise<void> => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { is_sleeping: false })) // still awake
      .mockResolvedValueOnce(mockResponse(200, { is_sleeping: true }));  // sleeping

    const result = await strategy.waitForModelUnload(10);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0];
    expect(String(firstUrl as string)).toBe('http://localhost:8080/props');
  });

  it('getContextWindow() always null', async (): Promise<void> => {
    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('hasVisionCapability() always false without any fetch call', async (): Promise<void> => {
    expect(await strategy.hasVisionCapability('test-model')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});