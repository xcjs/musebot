import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILlmHost } from '../models/ILlmHost.js';
import { NullLifecycleStrategy } from './NullLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
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

  it('waitForModelUnload() resolves true immediately with zero fetch calls', async (): Promise<void> => {
    expect(await strategy.waitForModelUnload()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getContextWindow() reads context_length from the models catalog', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'another-model', object: 'model' }, { id: 'test-model', context_length: 262144 }]
    }));

    expect(await strategy.getContextWindow()).toBe(262144);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url as string)).toBe('http://localhost:8080/models');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('getContextWindow() sends Bearer token when the host has one', async (): Promise<void> => {
    const tokenStrategy = new NullLifecycleStrategy(
      makeHost('http://localhost:8080', 'sk-token'), 'test-model', mockLogger as never);
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'test-model', context_length: 4096 }] }));

    expect(await tokenStrategy.getContextWindow()).toBe(4096);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer sk-token');
  });

  it('getContextWindow() null when the model is absent from the catalog', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'another-model', context_length: 4096 }] }));

    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('getContextWindow() null when the entry has no context_length', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'test-model', object: 'model' }] }));

    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('getContextWindow() null on failed HTTP response', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(500, {}));

    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('getContextWindow() null on malformed payload', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, 'not-a-catalog'));

    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('getContextWindow() null when fetch rejects', async (): Promise<void> => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    expect(await strategy.getContextWindow()).toBeNull();
  });

  it('hasVisionCapability() true when the catalog lists image input', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'test-model', architecture: { input_modalities: ['text', 'image'] } }]
    }));

    expect(await strategy.hasVisionCapability()).toBe(true);
  });

  it('hasVisionCapability() false when the catalog lists only text', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'test-model', architecture: { input_modalities: ['text'] } }]
    }));

    expect(await strategy.hasVisionCapability()).toBe(false);
  });

  it('hasVisionCapability() false when the model is absent from the catalog', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'another-model', architecture: { input_modalities: ['image'] } }]
    }));

    expect(await strategy.hasVisionCapability()).toBe(false);
  });

  it('hasVisionCapability() false on a failed HTTP response', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(500, {}));

    expect(await strategy.hasVisionCapability()).toBe(false);
  });

  it('hasVisionCapability() checks the model it is asked about', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'another-model', architecture: { input_modalities: ['image'] } }]
    }));

    expect(await strategy.hasVisionCapability('another-model')).toBe(true);
  });
});