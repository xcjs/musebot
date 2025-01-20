import process from 'node:process';

import { beforeEach, describe, expect, test } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../package.json' with { type: 'json' };
import { BotFunction } from '../enums/BotFunction.js';
import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { EnvironmentSettings } from './EnvironmentSettings';

beforeEach(() => {
    // Preset all minimally required values for most tests to pass.
    process.env.MUSEBOT_DISCORD_TOKEN = 'mockToken';
    process.env.MUSEBOT_FUNCTION = BotFunction.Images;
    process.env.MUSEBOT_STABLE_DIFFUSION_HOSTS = 'http://localhost';
});

describe('EnvironmentSettings', () => {
    describe('packageName', () => {
        test('it should equal the package name in package.json', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.packageName).toBe(nodePackage.name);
        });
    });

    describe('version', () => {
        test('it should equal the version number in package.json', () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.version).toBe(nodePackage.version);
        });
    });

    describe('nodeEnvironment', () => {
        test(`it should return test in the testing environment without mocking`, () => {
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.nodeEnvironment).toBe(NodeEnvironment.Test);
        });

        test.each([
            NodeEnvironment.Development,
            NodeEnvironment.Production
        ])(`it should match the NODE_ENV environment variable`, (environment) => {
            process.env.NODE_ENV = environment;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.nodeEnvironment).toBe(environment);
        });
    });
});
