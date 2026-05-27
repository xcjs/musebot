import * as fs from 'node:fs';

import { IBotConfig } from './IBotConfig.js';
import { IGlobalSettings } from './IGlobalSettings.js';

export interface IAppConfig {
    global: IGlobalSettings;
    bots: IBotConfig[];
}

export class ConfigLoader {
    static load(): IAppConfig {
        const configPath = './config.json';

        if(!fs.existsSync(configPath)) {
            const errorMessage = 'config.json could not be found or accessed.';
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content) as IAppConfig;
        } catch (error) {
            const errorMessage = 'config.json could not be parsed. Does it contain syntax errors?';
            console.error(errorMessage);
            throw (error);
        }
    }
}
