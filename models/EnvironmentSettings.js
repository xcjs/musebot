import process from 'node:process';

import dotenv from 'dotenv';
import { Logger, LogLevel } from 'meklog';

export class EnvironmentSettings {
    nodeEnvironment = null;

    discordToken = null;
    discordChannels = [];

    easyDiffusionHosts = [];
    easyDiffusionModels = [];

    botRequiresMention = true;
    errorMessage = 'An error occurred while generating your image. Please try again later.';

    #logger = null;

    #validNodeEnvironments = [
        'development',
        'production'
    ];

    get isProduction() {
        return this.nodeEnvironment === 'production';
    }

    constructor() {
        dotenv.config();

        this.nodeEnvironment = process.env.NODE_ENV;

        this.discordToken = process.env.MUSEBOT_DISCORD_TOKEN?.trim();
        this.discordChannels = process.env.MUSEBOT_DISCORD_CHANNELS?.trim().split(',');

        this.botRequiresMention = (process.env.MUSEBOT_REQUIRES_MENTION?.trim().toLowerCase() === true.toString());
        this.errorMessage = process.env.MUSEBOT_ERROR_MESSAGE || this.errorMessage;

        this.easyDiffusionHosts = process.env.MUSEBOT_EASY_DIFFUSION_HOSTS?.trim().split(',').map(url => new URL(url));
        this.easyDiffusionModels = process.env.MUSEBOT_EASY_DIFFUSION_MODELS?.trim().split(',').filter(x => x.length > 0) || [];

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');
        this.#logConfiguration();
        this.#validate();
    }

    #logConfiguration() {
        this.#logger(LogLevel.Info, `NODE_ENV: ${this.nodeEnvironment}`);
        this.#logger(LogLevel.Info, `MUSEBOT_DISCORD_TOKEN: ${this.discordToken}`);
        this.#logger(LogLevel.Info, `MUSEBOT_DISCORD_CHANNELS: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_REQUIRES_MENTION: ${this.botRequiresMention}`);
        this.#logger(LogLevel.Info, `MUSEBOT_EASY_DIFFUSION_HOSTS: ${this.easyDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_EASY_DIFFUSION_MODELS: ${this.easyDiffusionModels.join(', ')}`);
    }

    #validate() {
        if(!this.#validNodeEnvironments.includes(this.nodeEnvironment)) {
            throw new Error(`NODE_ENV should be one of ${this.#validNodeEnvironments.join(', ')} but is ${this.nodeEnvironment} instead.`);
        }

        if(this.discordToken === null || this.discordToken.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_TOKEN requires a value.`);
        }

        if(this.easyDiffusionHosts.length === 0) {
            throw new Error(`MUSEBOT_EASY_DIFFUSION_HOSTS requires at least one value.`);
        }
    }
}
