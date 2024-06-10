import process from 'node:process';

import dotenv from 'dotenv';
import { Logger, LogLevel } from 'meklog';

export class EnvironmentSettings {
    nodeEnvironment = null;

    discordToken = null;
    discordChannels = [];

    easyDiffusionHosts = [];
    easyDiffusionModel = null;

    botRequiresMention = true;

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

        this.discordToken = process.env.EASY_DIFFUSION_DISCORD_BOT_TOKEN;
        this.discordChannels = process.env.EASY_DIFFUSION_DISCORD_BOT_CHANNELS.split(',');

        this.easyDiffusionHosts = process.env.EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_HOSTS.split(',').map(url => new URL(url));
        this.easyDiffusionModel = process.env.EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_MODEL;

        this.botRequiresMention = (process.env.EASY_DIFFUSION_DISCORD_BOT_REQUIRES_MENTION.toLowerCase() === 'true');

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');
        this.#logConfiguration();
        this.#validate();
    }

    #logConfiguration() {
        this.#logger(LogLevel.Info, `NODE_ENV: ${this.nodeEnvironment}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_TOKEN: ${this.discordToken}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_CHANNELS: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_HOSTS: ${this.easyDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_MODEL: ${this.easyDiffusionModel}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_REQUIRES_MENTION: ${this.botRequiresMention}`);
    }

    #validate() {
        if(!this.#validNodeEnvironments.includes(this.nodeEnvironment)) {
            throw new Error(`NODE_ENV should be one of ${this.#validNodeEnvironments.join(', ')} but is ${this.nodeEnvironment} instead.`);
        }

        if(this.discordToken === null || this.discordToken.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_TOKEN requires a value.`);
        }

        if(this.discordChannels.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_CHANNELS requires at least one channel ID.`);
        }

        if(this.easyDiffusionHosts.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_HOSTS requires at least one value.`);
        }

        if(this.easyDiffusionModel === null || this.easyDiffusionModel.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_MODEL requires a value.`);
        }
    }
}
