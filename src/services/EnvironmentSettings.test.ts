import process from 'node:process';

import { describe, expect, test } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../package.json' with { type: 'json' };
import { BotFunction } from '../enums/BotFunction.js';
import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { EnvironmentSettings } from './EnvironmentSettings';

describe('EnvironmentSettings', () => {
    describe('packageName', () => {
        test('it should equal the package name in package.json', () => {
            process.env.MUSEBOT_FUNCTION = BotFunction.Images;
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.packageName).toBe(nodePackage.name);
        });
    });

    describe('version', () => {
        test('it should equal the version number in package.json', () => {
            process.env.MUSEBOT_FUNCTION = BotFunction.Images;
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.version).toBe(nodePackage.version);
        });
    });

    describe('nodeEnvironment', () => {
        test(`it should return test in the testing environment without mocking`, () => {
            process.env.MUSEBOT_FUNCTION = BotFunction.Images;
            const environmentSettings = new EnvironmentSettings();
            expect(environmentSettings.nodeEnvironment).toBe(NodeEnvironment.Test);
        });

        test.each([
            NodeEnvironment.Development,
            NodeEnvironment.Production
        ])(`it should match the NODE_ENV environment variable`, (environment) => {
            process.env.NODE_ENV = environment;
            process.env.MUSEBOT_FUNCTION = BotFunction.Images;
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.nodeEnvironment).toBe(environment);
        });
    });
});
