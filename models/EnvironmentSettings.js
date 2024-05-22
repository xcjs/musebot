import { process } from 'node:process';

import { Logger, LogLevel } from 'meklog';

export class EnvironmentSettings {
    nodeEnvironment = null;

    discordToken = null;
    discordChannels = [];

    easyDiffusionHosts = [];
    easyDiffusionModel = null;

    botRequiresMention = true;

    #logger = null;

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

        this.botRequiresMention = (process.env.EASY_DIFFUSION_DISCORD_BOT_REQUIRES_MENTION.toLower() === 'true');

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');
        this.#logConfiguration();
    }

    #logConfiguration() {
        this.#logger(LogLevel.Info, `NODE_ENV: ${this.nodeEnvironment}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_TOKEN: ${this.discordToken}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_CHANNELS: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_HOSTS: ${this.easyDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_EASY_DIFFUSION_MODEL: ${this.easyDiffusionModel}`);
        this.#logger(LogLevel.Info, `EASY_DIFFUSION_DISCORD_BOT_REQUIRES_MENTION: ${this.botRequiresMention}`);
    }
}
