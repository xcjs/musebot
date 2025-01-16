import { describe, expect, test } from '@jest/globals';

import { EnvironmentSettings } from './EnvironmentSettings';

describe('EnvironmentSettings', () => {
    describe('packageName', () => {
        test('it should equal the package name in package.json', () => {
            const environmentSettings = new EnvironmentSettings();

            expect(environmentSettings.packageName).toBe('musebot');
        });
    });
});
