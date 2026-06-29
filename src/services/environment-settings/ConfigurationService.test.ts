import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { ConfigurationService } from './ConfigurationService.js';

jest.mock('./ConfigLoader.js', () => ({
    ConfigLoader: {
        load: jest.fn()
    }
}));

import { ConfigLoader } from './ConfigLoader.js';
import type { IBotConfig } from './IBotConfig.js';

const mockToken = 'mockToken';
const mockUrl = 'http://localhost/';

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
    ollama: {
        hosts: [mockUrl],
        models: ['model1', 'model2'],
        systemPrompt: 'You are a helpful assistant',
        streamsResponse: false
    },
    comfyUi: {
        hosts: []
    }
};

const validMediaBotConfig = {
    botId: 'bot-1',
    nodeEnvironment: 'test',
    mode: 'media' as BotMode,
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
    ollama: {
        hosts: [mockUrl],
        models: [],
        systemPrompt: 'You are a helpful assistant',
        streamsResponse: false
    },
    comfyUi: {
        hosts: ['http://localhost:8188']
    }
};

const globalConfig = {
    taskQueue: {
        numAttempts: 10,
        retryDelayMs: 1000,
        strategy: TaskQueueStrategy.Serial,
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

describe('ConfigurationService', () => {
    describe('configuration loading', () => {
        it('should load configuration from config.jsonc by default', () => {
            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);

            expect(service.nodeEnvironment).toBe(NodeEnvironment.Test);
             
            expect(jest.mocked(ConfigLoader.load)).toHaveBeenCalled();
        });
    });

    describe('mode validation', () => {
        it('should load successfully with chat mode', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.nodeEnvironment).toBe(NodeEnvironment.Test);
        });

        it('should load successfully with media mode', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validMediaBotConfig]
            });

            const service = new ConfigurationService(validMediaBotConfig as unknown as IBotConfig);
            expect(service.nodeEnvironment).toBe(NodeEnvironment.Test);
        });

        it('should throw error for invalid mode', () => {
            const invalidBotConfig = {
                ...validChatBotConfig,
                mode: 'invalid'
            };

            expect(() => {
                new ConfigurationService(invalidBotConfig as unknown as IBotConfig);
            }).toThrow(/Invalid mode/);
        });

        it('should validate required fields for media mode', () => {
            const configWithoutHosts = {
                ...validMediaBotConfig,
                comfyUi: {
                    hosts: []
                }
            };

            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [configWithoutHosts]
            });

            expect(() => {
                new ConfigurationService(configWithoutHosts as unknown as IBotConfig);
            }).toThrow('Media mode requires at least one ComfyUI host configured in comfyUi.hosts.');
        });

        it('should validate required fields for chat mode', () => {
            const configWithoutOllamaHosts = {
                ...validChatBotConfig,
                ollama: {
                    hosts: [],
                    models: [],
                    systemPrompt: '',
                    streamsResponse: false
                }
            };

            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [configWithoutOllamaHosts]
            });

            expect(() => {
                new ConfigurationService(configWithoutOllamaHosts as unknown as IBotConfig);
            }).toThrow('Chat mode requires at least one Ollama host configured in ollama.hosts.');
        });

        it('should warn for missing ollama models in chat mode', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const config = {
                ...validChatBotConfig,
                ollama: {
                    hosts: [mockUrl],
                    models: [],
                    systemPrompt: '',
                    streamsResponse: false
                }
            };

            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [config]
            });

            new ConfigurationService(config as unknown as IBotConfig);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[ConfigurationService] Warning: Chat mode has no Ollama models configured. Model selection not yet supported.'
            );

            consoleSpy.mockRestore();
        });
    });

    describe('environment variable validation', () => {
        it('should throw error when MUSEBOT_* environment variables are detected', () => {
            process.env.MUSEBOT_TEST = 'value';

            expect(() => {
                new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            }).toThrow(/\.env support has been removed/);
        });

        it('should throw error with detected environment variable names', () => {
            process.env.MUSEBOT_FUNCTION = 'chat';
            process.env.MUSEBOT_DISCORD_TOKEN = '12345';

            const expectedVars = 'MUSEBOT_FUNCTION, MUSEBOT_DISCORD_TOKEN';

            expect(() => {
                new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            }).toThrow(expectedVars);
        });
    });

    describe('properties', () => {
        it('should have botId', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.botId).toBe('bot-1');
        });

        it('should have botResponseRate', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.botResponseRate).toBe(100);
        });

        it('should have taskQueue configuration', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.maxTaskAttempts).toBe(10);
            expect(service.taskRetryDelayMilliseconds).toBe(1000);
            expect(service.taskQueueStrategy).toBe(TaskQueueStrategy.Serial);
            expect(service.taskQueueForceSerialAcrossHosts).toBe(false);
        });

        it('should have discord configuration', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.discordToken).toBe(mockToken);
            expect(service.discordChannels).toEqual(['1234567891234567892']);
        });

        it('should have ollama configuration', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.ollamaHosts).toEqual([new URL(mockUrl)]);
            expect(service.ollamaModels).toEqual(['model1', 'model2']);
            expect(service.ollamaSystemPrompt).toBe('You are a helpful assistant');
            expect(service.ollamaStreamsResponse).toBe(false);
        });

        it('should join system prompt array with newlines', () => {
            const configWithArrayPrompt = {
                ...validChatBotConfig,
                ollama: {
                    ...validChatBotConfig.ollama,
                    systemPrompt: ['You are a helpful assistant.', 'Always be concise.', 'Never hallucinate.']
                }
            };

            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [configWithArrayPrompt]
            });

            const service = new ConfigurationService(configWithArrayPrompt as unknown as IBotConfig);
            expect(service.ollamaSystemPrompt).toBe('You are a helpful assistant.\nAlways be concise.\nNever hallucinate.');
        });

        it('should have applicationName', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.applicationName).toBe('Musebot');
        });

        it('should have isProduction', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.isProduction).toBe(false);
        });
    });

    describe('comfyUI', () => {
        it('should have comfyUi configuration', () => {
            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [validChatBotConfig]
            });

            const service = new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
            expect(service.comfyUiHosts).toEqual([]);
            expect(service.comfyUiGuidanceScaleInterval).toBe(0.5);
        });

        it('should have correct guidanceScaleInterval from config', () => {
            const configWithCustomInterval = {
                ...validChatBotConfig,
                comfyUi: {
                    ...validChatBotConfig.comfyUi,
                    guidanceScaleInterval: 0.7
                }
            };

            (ConfigLoader.load as jest.Mock).mockReturnValue({
                global: globalConfig,
                bots: [configWithCustomInterval]
            });

            const service = new ConfigurationService(configWithCustomInterval as unknown as IBotConfig);
            expect(service.comfyUiGuidanceScaleInterval).toBe(0.7);
        });
    });
});

describe('ConfigurationService error cases', () => {
    beforeEach(() => {
        (ConfigLoader.load as jest.Mock).mockImplementation(() => {
            throw new Error('config.jsonc could not be found or accessed.');
        });

        Object.keys(process.env).filter(key => key.startsWith('MUSEBOT_')).forEach(key => {
            delete process.env[key];
        });
    });

    it('should throw error when config file does not exist', () => {
        (ConfigLoader.load as jest.Mock).mockImplementation(() => {
            throw new Error('./config.jsonc could not be found or accessed.');
        });

        expect(() => {
            new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
        }).toThrow('./config.jsonc could not be found or accessed.');
    });

    it('should throw error when JSON syntax is invalid', () => {
        (ConfigLoader.load as jest.Mock).mockImplementation(() => {
            throw new Error('config.jsonc could not be parsed.');
        });

        expect(() => {
            new ConfigurationService(validChatBotConfig as unknown as IBotConfig);
        }).toThrow('config.jsonc could not be parsed.');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Object.keys(process.env).filter(key => key.startsWith('MUSEBOT_')).forEach(key => {
            delete process.env[key];
        });
    });
});