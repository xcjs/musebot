import * as fs from 'node:fs';

import { parse } from 'json5';

import { IBotConfig } from './IBotConfig.js';
import { IGlobalSettings } from './IGlobalSettings.js';

export interface IAppConfig {
    global: IGlobalSettings;
    bots: IBotConfig[];
}

export class ConfigLoader {
    static load(): IAppConfig {
        const configPath = fs.existsSync('./config.json')
            ? './config.json'
            : './config.jsonc';

        if(!fs.existsSync(configPath)) {
            const errorMessage = `${configPath} could not be found or accessed.`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return parse(content);
        } catch (error) {
            const errorMessage = `${configPath} could not be parsed. Does it contain syntax errors?`;
            console.error(errorMessage);
            throw (error);
        }
    }
}
