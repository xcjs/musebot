import * as fs from 'node:fs';

import JSON5 from 'json5';

import { IBotConfig } from './IBotConfig.js';
import { IGlobalConfiguration } from './IGlobalConfiguration.js';

export interface IAppConfig {
  global: IGlobalConfiguration;
  bots: Array<IBotConfig>;
}

export class ConfigLoader {
  static load(): IAppConfig {
    // Prefer config.jsonc (supports comments); fall back to plain config.json.
    const configPath = fs.existsSync('./config.jsonc')
      ? './config.jsonc'
      : './config.json';

    if(!fs.existsSync(configPath)) {
      const errorMessage = `${configPath} could not be found or accessed.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON5.parse(content);
    } catch (error) {
      const errorMessage = `${configPath} could not be parsed. Does it contain syntax errors?`;
      console.error(errorMessage);
      throw (error);
    }
  }
}