import process from 'node:process';

import { beforeEach, describe, expect, it, test } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../../package.json' with { type: 'json' };
import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
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
        ])(`should match the ${EnvironmentKey.NodeEnvironment} environment variable`, (environment) => {
            process.env[EnvironmentKey.NodeEnvironment] = environment;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.nodeEnvironment).toBe(environment);

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
            process.env.MUSEBOT_FUNCTION = 'invalidFunction';

            expect(() => {
               new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('maxTaskAttempts', () => {
        it('should default to 10', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.maxTaskAttempts).toBe(10);
        });

        it('should prefer the provided value', () => {
            const mockMaxAttempts = 1000;

            process.env.MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS = mockMaxAttempts.toString();
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.maxTaskAttempts).toBe(mockMaxAttempts);
        });

        it('should not accept non-numeric values', () => {
            const mockMaxAttempts = 'invalidValue';

            process.env.MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS = mockMaxAttempts;

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
            process.env.MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS = mockRetryDelay.toString();
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.taskRetryDelayMilliseconds).toBe(mockRetryDelay);
        });

        it('should not accept non-numeric values', () => {
            const mockRetryDelay = 'invalidValue';

            process.env.MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS = mockRetryDelay;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();
        });
    });

    describe('discordToken', () => {
        it('should be required', () => {
            const originalMockToken = process.env.MUSEBOT_DISCORD_TOKEN;
            delete process.env.MUSEBOT_DISCORD_TOKEN;

            expect(() => {
                new EnvironmentSettings();
            }).toThrow();

            process.env.MUSEBOT_DISCORD_TOKEN = originalMockToken;
        });

        it('should equal the associated environment variable', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.discordToken).toBe(process.env.MUSEBOT_DISCORD_TOKEN);
        });
    });

    describe('discordChannels', () => {
        it('should be optional', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.discordChannels.length).toBe(0);
        });

        it('should support one value', () => {
            const mockChannelId = '1234567891234567891'
            process.env.MUSEBOT_DISCORD_CHANNELS = mockChannelId;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannels).toStrictEqual([mockChannelId])
        });

        it('should support comma separated values', () => {
            const mockChannelIds = [
                '1234567891234567891',
                '1234567891234567892',
                '1234567891234567893'
            ];

            process.env.MUSEBOT_DISCORD_CHANNELS = mockChannelIds.join(',');
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
            process.env.MUSEBOT_DISCORD_CHANNELS_DISALLOWED = mockChannelId;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.discordChannelsDisallowed).toStrictEqual([mockChannelId])
        });

        it('should support comma separated values', () => {
            const mockChannelIds = [
                '1234567891234567891',
                '1234567891234567892',
                '1234567891234567893'
            ];

            process.env.MUSEBOT_DISCORD_CHANNELS_DISALLOWED = mockChannelIds.join(',');
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
            process.env.MUSEBOT_REQUIRES_MENTION = botRequiresMention;
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
            process.env.MUSEBOT_REQUIRES_MENTION = botRequiresMention;
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
            process.env.MUSEBOT_ERROR_MESSAGE = mockErrorMessage;

            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.errorMessage).toBe(mockErrorMessage);
        });
    });
});
