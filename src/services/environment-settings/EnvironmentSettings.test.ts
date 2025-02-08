import process from 'node:process';

import { beforeEach, describe, expect, it, test } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../../package.json' with { type: 'json' };
import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { StableDiffusionApiType } from '../clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { EnvironmentKey } from './constants/EnvironmentKey.js';
import { EnvironmentSettings } from './EnvironmentSettings';

const mockToken = 'mockToken';
const mockUrl = 'http://localhost/';

beforeEach(() => {
    // Clear any configuration values ahead of time in case a configuration file
    // is present or any environment variables are set.
    process.env = {
        // NODE_ENV should be preserved as Jest sets this to "test".
        [EnvironmentKey.NodeEnvironment]: process.env[EnvironmentKey.NodeEnvironment] || NodeEnvironment.Test,
        // Preset all minimally required values for most tests to pass.
        [EnvironmentKey.BotFunction]: BotFunction.Images,
        [EnvironmentKey.StableDiffusionApiType]: StableDiffusionApiType.ComfyUI,
        [EnvironmentKey.AuthenticationToken]: mockToken,
        [EnvironmentKey.StableDiffusionHosts]: mockUrl
    };
});

describe('EnvironmentSettings', () => {
    describe('packageName', () => {
        it('should equal the package name in package.json', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.packageName).toBe(nodePackage.name);
        });
    });

    describe('version', () => {
        it('should equal the version number in package.json', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.version).toBe(nodePackage.version);
        });
    });

    describe('nodeEnvironment', () => {
        it(`should return test in the testing environment without mocking`, () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.nodeEnvironment).toBe(NodeEnvironment.Test);
        });

        test.each([
            NodeEnvironment.Development,
            NodeEnvironment.Production
        ])(`should match the ${EnvironmentKey.NodeEnvironment} environment variable`, (nodeEnvironment) => {
            process.env[EnvironmentKey.NodeEnvironment] = nodeEnvironment;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.nodeEnvironment).toBe(nodeEnvironment);

            // Reset the environment after this test to prevent scope leak.
            process.env[EnvironmentKey.NodeEnvironment] = NodeEnvironment.Test;
        });
    });

    describe('botFunction', () => {
        it('should be required', () => {
            delete process.env[EnvironmentKey.BotFunction];

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });

        test.each([
            BotFunction.Images,
            BotFunction.Text
        ])('should accept any valid BotFunction value', (botFunction: BotFunction) => {
            process.env[EnvironmentKey.BotFunction] = botFunction;
            process.env[EnvironmentKey.OllamaHosts] = mockUrl;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botFunction).toBe(botFunction);
        });

        it('should not accept any invalid value', () => {
            process.env[EnvironmentKey.BotFunction] = 'invalidFunction';

            expect(() => {
               new EnvironmentSettings();
            }).toThrow();
        });

        test.each([
            { generativeAiHosts: '', botFunction: BotFunction.Images, environmentKey: EnvironmentKey.StableDiffusionHosts },
            { generativeAiHosts: null, botFunction: BotFunction.Images, environmentKey: EnvironmentKey.StableDiffusionHosts },
            { generativeAiHosts: undefined, botFunction: BotFunction.Images, environmentKey: EnvironmentKey.StableDiffusionHosts },
            { generativeAiHosts: '', botFunction: BotFunction.Text, environmentKey: EnvironmentKey.OllamaHosts },
            { generativeAiHosts: null, botFunction: BotFunction.Text, environmentKey: EnvironmentKey.OllamaHosts },
            { generativeAiHosts: undefined, botFunction: BotFunction.Text, environmentKey: EnvironmentKey.OllamaHosts },
        ])('should require the corresponding generative AI hosts to be provided when the bot function is set',
            ({ generativeAiHosts, botFunction, environmentKey }:
                { generativeAiHosts: string | null | undefined, botFunction: BotFunction, environmentKey: EnvironmentKey }) => {
                process.env[EnvironmentKey.BotFunction] = botFunction;
                process.env[environmentKey] = generativeAiHosts;

                expect(() => {
                    new EnvironmentSettings();
                }).toThrow();
        });

        test.each([
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: '',
                botFunction: BotFunction.Images,
                associatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts,
                unassociatedEnvironmentKey: EnvironmentKey.OllamaHosts
            },
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: null,
                botFunction: BotFunction.Images,
                associatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts,
                unassociatedEnvironmentKey: EnvironmentKey.OllamaHosts
            },
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: undefined,
                botFunction: BotFunction.Images,
                associatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts,
                unassociatedEnvironmentKey: EnvironmentKey.OllamaHosts
            },
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: '',
                botFunction: BotFunction.Text,
                associatedEnvironmentKey: EnvironmentKey.OllamaHosts,
                unassociatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts
            },
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: null,
                botFunction: BotFunction.Text,
                associatedEnvironmentKey: EnvironmentKey.OllamaHosts,
                unassociatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts
            },
            {
                associatedGenerativeAiHosts: mockUrl,
                unassociatedGenerativeAiHosts: undefined,
                botFunction: BotFunction.Text,
                associatedEnvironmentKey: EnvironmentKey.OllamaHosts,
                unassociatedEnvironmentKey: EnvironmentKey.StableDiffusionHosts
            },
        ])('should not require the unassociated generative AI hosts to be provided when the bot function is set',
            ({
                associatedGenerativeAiHosts,
                unassociatedGenerativeAiHosts,
                botFunction,
                associatedEnvironmentKey,
                unassociatedEnvironmentKey
             }: {
                associatedGenerativeAiHosts: string,
                unassociatedGenerativeAiHosts: string | null | undefined,
                botFunction: BotFunction,
                associatedEnvironmentKey: EnvironmentKey,
                unassociatedEnvironmentKey: EnvironmentKey
            }) => {
                process.env[EnvironmentKey.BotFunction] = botFunction;
                process.env[associatedEnvironmentKey] = associatedGenerativeAiHosts;
                process.env[unassociatedEnvironmentKey] = unassociatedGenerativeAiHosts;

                expect(() => {
                    new EnvironmentSettings();
                }).not.toThrow();
        });
    });

    describe('maxTaskAttempts', () => {
        it('should default to 10', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.maxTaskAttempts).toBe(10);
        });

        it('should prefer the provided value', () => {
            const mockMaxAttempts = 1000;

            process.env[EnvironmentKey.TaskQueueMaxAttempts] = mockMaxAttempts.toString();
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.maxTaskAttempts).toBe(mockMaxAttempts);
        });

        it('should not accept non-numeric values', () => {
            const mockMaxAttempts = 'invalidValue';

            process.env[EnvironmentKey.TaskQueueMaxAttempts] = mockMaxAttempts;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('taskRetryDelayMilliseconds', () => {
        it('should default to 1 second', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.taskRetryDelayMilliseconds).toBe(1000);
        });

        it('should prefer the provided value', () => {
            const mockRetryDelay = 5000;
            process.env[EnvironmentKey.TaskQueueRetryDelayMs] = mockRetryDelay.toString();
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.taskRetryDelayMilliseconds).toBe(mockRetryDelay);
        });

        it('should not accept non-numeric values', () => {
            const mockRetryDelay = 'invalidValue';

            process.env[EnvironmentKey.TaskQueueRetryDelayMs] = mockRetryDelay;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('discordToken', () => {
        it('should be required', () => {
            delete process.env[EnvironmentKey.AuthenticationToken];

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });

        it('should equal the associated environment variable', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.discordToken).toBe(process.env[EnvironmentKey.AuthenticationToken]);
        });
    });

    describe('discordChannels', () => {
        it('should be optional', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.discordChannels.length).toBe(0);
        });

        it('should support one value', () => {
            const mockChannelId = '1234567891234567891'
            process.env[EnvironmentKey.ChatChannels] = mockChannelId;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannels).toStrictEqual([mockChannelId])
        });

        it('should support comma separated values', () => {
            const mockChannelIds = [
                '1234567891234567891',
                '1234567891234567892',
                '1234567891234567893'
            ];

            process.env[EnvironmentKey.ChatChannels] = mockChannelIds.join(',');
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannels).toStrictEqual(mockChannelIds);
        });
    });

    describe('discordChannelsDisallowed', () => {
        it('should be optional', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.discordChannelsDisallowed.length).toBe(0);
        });

        it('should support one value', () => {
            const mockChannelId = '1234567891234567891'
            process.env[EnvironmentKey.ChatChannelsDisallowed] = mockChannelId;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannelsDisallowed).toStrictEqual([mockChannelId])
        });

        it('should support comma separated values', () => {
            const mockChannelIds = [
                '1234567891234567891',
                '1234567891234567892',
                '1234567891234567893'
            ];

            process.env[EnvironmentKey.ChatChannelsDisallowed] = mockChannelIds.join(',');
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannelsDisallowed).toStrictEqual(mockChannelIds);
        });
    });

    describe('botRequiresMention', () => {
        it('should default to false', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.botRequiresMention).toBe(false);
        });

        test.each([
            'false',
            'FALSE',
            'tru',
            'invalidValue',
            undefined,
            null
        ]
        )('should convert any other provided value to false', (botRequiresMention: string | null | undefined) => {
            process.env[EnvironmentKey.BotRequiresMention] = botRequiresMention;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botRequiresMention).toBe(false);
        });

        test.each([
            'true',
            'TRUE',
            'true ',
            ' true',
            ' true '
        ])('should accept any valid version of "true"', (botRequiresMention: string) => {
            process.env[EnvironmentKey.BotRequiresMention] = botRequiresMention;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botRequiresMention).toBe(true);
        });
    });

    describe('botResponseRate', () => {
        it('should default to 100', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.botResponseRate).toBe(100);
        });

        it('should prefer the provided value', () => {
            const mockResponseRate = 50;
            process.env[EnvironmentKey.BotResponseRate] = mockResponseRate.toString();

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botResponseRate).toBe(mockResponseRate);
        });

        test.each([
            -1, 0, 101
        ])('should default to 100 when the value is outside the valid range', (rate: number) => {
            process.env[EnvironmentKey.BotResponseRate] = rate.toString();

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botResponseRate).toBe(100);
        });

        it('should default to 100 when an invalid value is provided', () => {
            process.env[EnvironmentKey.BotResponseRate] = 'invalidValue';

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botResponseRate).toBe(100);
        });

        it('should floor floating point values', () => {
            process.env[EnvironmentKey.BotResponseRate] = '1.5';

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.botResponseRate).toBe(1);
        });
    });

    describe('errorMessage', () => {
        it('should default to the default error message', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.errorMessage)
                .toBe('An error occurred while generating a response. Please try again later.');
        });

        it('should prefer the provided value', () => {
            const mockErrorMessage = 'mockError';
            process.env[EnvironmentKey.BotErrorMessage] = mockErrorMessage;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.errorMessage).toBe(mockErrorMessage);
        });
    });

    describe('stableDiffusionApiType', () => {
        test.each([
            StableDiffusionApiType.Automatic1111,
            StableDiffusionApiType.ComfyUI,
            StableDiffusionApiType.EasyDiffusion
        ])('it should work with each supported API definition', (apiType: StableDiffusionApiType) => {
            process.env[EnvironmentKey.StableDiffusionApiType] = apiType;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionApiType).toBe(apiType);
        });

        it('should throw an exception if an invalid API type is provided', () => {
            const invalidApiType = 'invalidApiType';
            process.env[EnvironmentKey.StableDiffusionApiType] = invalidApiType;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('stableDiffusionHosts', () => {
        const mockHosts = [
            mockUrl,
            'http://localhost:8080/'
        ];

        it('should be set to the configured Stable Diffusion hosts when one host is provided', () => {
            process.env[EnvironmentKey.StableDiffusionHosts] = mockUrl;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionHosts).toEqual([new URL(mockUrl)]);
        });

        it('should be set to the configured Stable Diffusion hosts when multiple hosts are provided', () => {
            process.env[EnvironmentKey.StableDiffusionHosts] = mockHosts.join(',');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionHosts).toEqual(mockHosts.map(x => new URL(x)));
        });

        it('should trim individual Stable Diffusion host values', () => {
            process.env[EnvironmentKey.StableDiffusionHosts] = mockHosts.join(', ');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionHosts).toEqual(mockHosts.map(x => new URL(x)));
        });

        it('should throw an exception for invalid URLs', () => {
            const invalidUrl = 'invalidUrl';
            process.env[EnvironmentKey.StableDiffusionApiType] = invalidUrl;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('stableDiffusionModels', () => {
        const modelBasedApis = [
            StableDiffusionApiType.Automatic1111,
            StableDiffusionApiType.EasyDiffusion
        ];

        const mockModels = [
            'mockModel1',
            'mockModel2',
            'mockModel3'
        ];

        test.each(modelBasedApis)('it should be set to configured Stable Diffusion models', (apiType: StableDiffusionApiType) => {
            process.env[EnvironmentKey.StableDiffusionApiType] = apiType;
            process.env[EnvironmentKey.StableDiffusionModels] = mockModels.join(',');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionModels).toEqual(mockModels);
        });

        test.each(modelBasedApis)('it should trim the configured Stable Diffusion models', (apiType: StableDiffusionApiType) => {
            process.env[EnvironmentKey.StableDiffusionApiType] = apiType;
            process.env[EnvironmentKey.StableDiffusionModels] = mockModels.join(', ');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionModels).toEqual(mockModels);
        });

        it('should not load Stable Diffusion models when the API type is ComfyUI', () => {
            process.env[EnvironmentKey.StableDiffusionApiType] = StableDiffusionApiType.ComfyUI;
            process.env[EnvironmentKey.StableDiffusionModels] = mockModels.join(', ');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.stableDiffusionModels).toEqual([]);
        });
    });

    describe('stableDiffusionGuidanceScaleInterval', () => {
        it('should equal .5',() => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.stableDiffusionGuidanceScaleInterval).toBe(.5);
        });
    });

    describe('ollamaHosts', () => {
        const mockHosts = [
            mockUrl,
            'http://localhost:8080/'
        ];

        it('should be set to the configured Ollama hosts when one host is provided', () => {
            process.env[EnvironmentKey.OllamaHosts] = mockUrl;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaHosts).toEqual([new URL(mockUrl)]);
        });

        it('should be set to the configured Ollama hosts when multiple hosts are provided', () => {
            process.env[EnvironmentKey.OllamaHosts] = mockHosts.join(',');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaHosts).toEqual(mockHosts.map(x => new URL(x)));
        });

        it('should trim individual Ollama host values', () => {
            process.env[EnvironmentKey.OllamaHosts] = mockHosts.join(', ');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaHosts).toEqual(mockHosts.map(x => new URL(x)));
        });

        it('should throw an exception for invalid URLs', () => {
            const invalidUrl = 'invalidUrl';
            process.env[EnvironmentKey.OllamaHosts] = invalidUrl;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('ollamaModels', () => {
        const mockModels = [
            'mockModel1',
            'mockModel2',
            'mockModel3'
        ];

        it('should be set to configured Stable Diffusion models', () => {
            process.env[EnvironmentKey.OllamaModels] = mockModels.join(',');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaModels).toEqual(mockModels);
        });

        it('should trim the configured Ollama models', () => {
            process.env[EnvironmentKey.OllamaModels] = mockModels.join(', ');

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaModels).toEqual(mockModels);
        });
    });

    describe('ollamaSystemPrompt', () => {
        it('should be set to the configured system prompt', () => {
            const mockSystemPrompt = 'mockSystemPrompt';
            process.env[EnvironmentKey.OllamaSystemPrompt] = mockSystemPrompt;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.ollamaSystemPrompt).toBe(mockSystemPrompt);
        });

        it('should handle undefined', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.ollamaSystemPrompt).toBe('');
        });
    });

    describe('ollamaStreamsResponse', () => {

    });

    describe('isProduction', () => {
        it('should return true when it is production', () => {
            process.env[EnvironmentKey.NodeEnvironment] = NodeEnvironment.Production;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.isProduction).toBe(true);

            // Reset the environment after this test to prevent scope leak.
            process.env[EnvironmentKey.NodeEnvironment] = NodeEnvironment.Test;
        });

        test.each([
            NodeEnvironment.Development,
            NodeEnvironment.Test
        ])('should return false when not production', (nodeEnvironment: NodeEnvironment) => {
            process.env[EnvironmentKey.NodeEnvironment] = nodeEnvironment;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.isProduction).toBe(false);

            // Reset the environment after this test to prevent scope leak.
            process.env[EnvironmentKey.NodeEnvironment] = NodeEnvironment.Test;
        });
    });
});
