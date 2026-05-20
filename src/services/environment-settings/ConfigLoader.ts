import * as fs from 'node:fs';

import { IBotConfig } from './IBotConfig.js';
import { IGlobalSettings } from './IGlobalSettings.js';

export interface IAppConfig {
    global: IGlobalSettings;
    bots: IBotConfig[];
}

export class ConfigLoader {
    static load(): IAppConfig | null {
        const configPath = './config.json';

        if(!fs.existsSync(configPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content) as IAppConfig;
        } catch (error) {
            console.error('Error parsing config.json:', error);
        }

        return null;
    }
}
