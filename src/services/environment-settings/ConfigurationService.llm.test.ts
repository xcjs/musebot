import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { ConfigurationService } from './ConfigurationService.js';

jest.mock('./ConfigLoader.js', () => ({
  ConfigLoader: {
    load: jest.fn()
  }
}));

import { ConfigLoader } from './ConfigLoader.js';
import type { IBotConfig } from './IBotConfig.js';

const mockToken = 'mockToken';

const validChatBotConfig = {
  botId: 'bot-1',
  nodeEnvironment: 'test',
  mode: 'chat' as BotMode,
  requiresMention: true,
  responseRate: 100,
  errorMessage: 'An error occurred',
  chatApis: {
    discord: {
      token: mockToken,
      channels: ['1234567891234567892'],
      privateMessageUsers: ['user2']
    }
  },
  llm: {
    hosts: [
      { url: 'http://localhost:11434' },
      { url: 'https://api.example.com', token: 'secret', isLocal: false }
    ],
    models: ['model1', 'model2'],
    systemPrompt: 'You are a helpful assistant',
    streamsResponse: false
  },
  comfyUi: {
    hosts: []
  }
};

const globalConfig = {
  taskQueue: {
    numAttempts: 10,
    retryDelayMs: 1000,
    strategy: 'serial',
    forceSerialAcrossHosts: false
  }
};

beforeEach(() => {
  (ConfigLoader.load as jest.Mock).mockReturnValue({
    global: globalConfig,
    bots: [validChatBotConfig]
  });

  Object.keys(process.env).filter(key => key.startsWith('MUSEBOT_')).forEach(key => {
    delete process.env[key];
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.keys(process.env).filter(key => key.startsWith('MUSEBOT_')).forEach(key => {
    delete process.env[key];
  });
});

describe('ConfigurationService (llm section)', () => {
  it('parses host objects into ILlmHost with defaults', () => {
    const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);

    expect(service.llmHosts).toHaveLength(2);
    expect(service.llmHosts[0].url).toEqual(new URL('http://localhost:11434'));
    expect(service.llmHosts[0].token).toBeNull();
    expect(service.llmHosts[0].isLocal).toBeNull();
    expect(service.llmHosts[1].url).toEqual(new URL('https://api.example.com'));
    expect(service.llmHosts[1].token).toBe('secret');
    expect(service.llmHosts[1].isLocal).toBe(false);
  });

  it('rejects bare-string hosts with the migration-pointer error', () => {
    const bareStringConfig = {
      ...validChatBotConfig,
      llm: {
        ...validChatBotConfig.llm,
        hosts: ['http://localhost:11434' as unknown as { url: string }]
      }
    };

    (ConfigLoader.load as jest.Mock).mockReturnValue({
      global: globalConfig,
      bots: [bareStringConfig]
    });

    expect(() => {
      new ConfigurationService(bareStringConfig as unknown as IBotConfig);
    }).toThrow('Bare-string hosts are no longer supported; wrap each host as { "url": "..." }. See docs/musebot/04-migration-v10.md.');
  });

  it('defaults llmVisionModels to []', () => {
    const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);

    expect(service.llmVisionModels).toEqual([]);
  });

  it('returns configured llmVisionModels', () => {
    const visionConfig = {
      ...validChatBotConfig,
      llm: {
        ...validChatBotConfig.llm,
        visionModels: ['llava']
      }
    };

    const service = new ConfigurationService(visionConfig as unknown as IBotConfig);

    expect(service.llmVisionModels).toEqual(['llava']);
  });

  it('exposes llm accessors for the rest of the section', () => {
    const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);

    expect(service.llmModels).toEqual(['model1', 'model2']);
    expect(service.llmSystemPrompt).toBe('You are a helpful assistant');
    expect(service.llmStreamsResponse).toBe(false);
    expect(service.llmEmbeddingModel).toBeNull();
    expect(service.llmTopK).toBe(5);
    expect(service.llmContextWindow).toBeNull();
    expect(service.llmContextCompressionThreshold).toBe(0.75);
  });

  it('joins array system prompts with newlines', () => {
    const arrayPromptConfig = {
      ...validChatBotConfig,
      llm: {
        ...validChatBotConfig.llm,
        systemPrompt: ['Line one.', 'Line two.']
      }
    };

    const service = new ConfigurationService(arrayPromptConfig as unknown as IBotConfig);

    expect(service.llmSystemPrompt).toBe('Line one.\nLine two.');
  });

  it('chat mode requires llm.hosts non-empty', () => {
    const noHostsConfig = {
      ...validChatBotConfig,
      llm: {
        ...validChatBotConfig.llm,
        hosts: []
      }
    };

    expect(() => {
      new ConfigurationService(noHostsConfig as unknown as IBotConfig);
    }).toThrow('Chat mode requires at least one LLM host configured in llm.hosts.');
  });

  it('chat mode warns (not throws) when no models configured', () => {
    const noModelsConfig = {
      ...validChatBotConfig,
      llm: {
        ...validChatBotConfig.llm,
        models: []
      }
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      new ConfigurationService(noModelsConfig as unknown as IBotConfig);
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Chat mode has no LLM models configured')
    );

    warnSpy.mockRestore();
  });

  it('nodeEnvironment test suppresses configuration logging', () => {
    const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);

    expect(service.nodeEnvironment).toBe(NodeEnvironment.Test);
  });
});