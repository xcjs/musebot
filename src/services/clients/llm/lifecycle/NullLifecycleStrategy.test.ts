import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILlmHost } from '../models/ILlmHost.js';
import { NullLifecycleStrategy } from './NullLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

describe('NullLifecycleStrategy', () => {
  let strategy: NullLifecycleStrategy;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    strategy = new NullLifecycleStrategy(
      makeHost('http://localhost:8080'),
      'test-model',
      mockLogger as never,
      ['vision-model']);
  });

  it('free() resolves true without any fetch call', async (): Promise<void> => {
    expect(await strategy.free()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isModelLoaded() always returns false without fetch', async (): Promise<void> => {
    expect(await strategy.isModelLoaded()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waitForModelUnload() resolves true immediately with zero fetch calls', async (): Promise<void> => {
    expect(await strategy.waitForModelUnload()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getContextWindow() always null', async (): Promise<void> => {
    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('hasVisionCapability() true only when model in visionModels', async (): Promise<void> => {
    expect(await strategy.hasVisionCapability('vision-model')).toBe(true);
    expect(await strategy.hasVisionCapability('other-model')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});