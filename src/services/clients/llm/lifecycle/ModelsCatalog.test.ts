import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ModelsCatalog } from './ModelsCatalog.js';

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('ModelsCatalog', () => {
  let catalog: ModelsCatalog;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach((): void => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    catalog = new ModelsCatalog('http://localhost:8080/v1/models', null);
  });

  it('getContextWindow() reads context_length for the model', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'another-model' }, { id: 'test-model', context_length: 262144 }]
    }));

    expect(await catalog.getContextWindow('test-model')).toBe(262144);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url as string)).toBe('http://localhost:8080/v1/models');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('getContextWindow() sends Bearer token when one is configured', async (): Promise<void> => {
    const tokenCatalog = new ModelsCatalog('http://localhost:8080/v1/models', 'sk-token');
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'test-model', context_length: 4096 }] }));

    expect(await tokenCatalog.getContextWindow('test-model')).toBe(4096);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer sk-token');
  });

  it('getContextWindow() null when the model is absent', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'another-model', context_length: 4096 }] }));

    expect(await catalog.getContextWindow('test-model')).toBeNull();
  });

  it('getContextWindow() null on a non-numeric context_length', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'test-model', context_length: 'big' }] }));

    expect(await catalog.getContextWindow('test-model')).toBeNull();
  });

  it('getContextWindow() null on failed HTTP response', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(500, {}));

    expect(await catalog.getContextWindow('test-model')).toBeNull();
  });

  it('inputModalities() normalizes a lowercase array', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'test-model', architecture: { input_modalities: ['text', 'image'] } }]
    }));

    expect(await catalog.inputModalities('test-model')).toEqual(['text', 'image']);
  });

  it('inputModalities() lowercases the array values', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'test-model', architecture: { input_modalities: ['Text', 'IMAGE'] } }]
    }));

    expect(await catalog.inputModalities('test-model')).toEqual(['text', 'image']);
  });

  it('inputModalities() splits a space-joined string', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, {
      data: [{ id: 'test-model', architecture: { input_modalities: 'text image' } }]
    }));

    expect(await catalog.inputModalities('test-model')).toEqual(['text', 'image']);
  });

  it('inputModalities() null when the architecture is absent', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'test-model' }] }));

    expect(await catalog.inputModalities('test-model')).toBeNull();
  });

  it('inputModalities() null when the model is absent', async (): Promise<void> => {
    fetchMock.mockResolvedValue(mockResponse(200, { data: [{ id: 'another-model', architecture: { input_modalities: ['image'] } }] }));

    expect(await catalog.inputModalities('test-model')).toBeNull();
  });

  it('propagates fetch rejections to the caller', async (): Promise<void> => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    await expect(catalog.getContextWindow('test-model')).rejects.toThrow('connection refused');
    await expect(catalog.inputModalities('test-model')).rejects.toThrow('connection refused');
  });
});