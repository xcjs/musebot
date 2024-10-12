import process from 'node:process';

import dotenv from 'dotenv';
import { Logger, LogLevel } from 'meklog';

import nodePackage from '../../package.json' with { type: 'json' };
import { NodeEnvironment } from 'enums/NodeEnvironment.js';
import { BotFunction } from 'enums/BotFunction.js';
import { StableDiffusionApiType } from 'services/clients/images/stable-diffusion/enums/StableDiffusionApiType';
import { IEnvironmentSettings } from 'services/IEnvironmentSettings';

export class EnvironmentSettings implements IEnvironmentSettings {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;

    botFunction: BotFunction;

    maxTaskAttempts: number = 100;

    discordToken: string;
    discordChannels: Array<string> = [];

    stableDiffusionApiType: StableDiffusionApiType;
    stableDiffusionHosts: Array<URL> = [];
    stableDiffusionModels: Array<string> = [];
    stableDiffusionGuidanceScaleInterval: number = .5;

    ollamaHosts: Array<URL> = [];
    ollamaModels: Array<string> = [];
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean = false;

    stableDiffusionOllamaPrompts: Array<string> = ['Describe something or someone with extraordinary detail.'];

    botRequiresMention: boolean = true;
    errorMessage: string = 'An error occurred while generating a response. Please try again later.';

    #logger;

    get isProduction() {
        return this.nodeEnvironment === NodeEnvironment.Production;
    }

    constructor() {
        dotenv.config();

        this.packageName = nodePackage.name;
        this.version = nodePackage.version;

        this.nodeEnvironment = process.env.NODE_ENV.trim() as NodeEnvironment;

        this.botFunction = process.env.MUSEBOT_FUNCTION.trim() as BotFunction;

        this.discordToken = process.env.MUSEBOT_DISCORD_TOKEN?.trim() || '';
        this.discordChannels = process.env.MUSEBOT_DISCORD_CHANNELS?.trim().split(',') || [];

        this.botRequiresMention = (process.env.MUSEBOT_REQUIRES_MENTION?.trim().toLowerCase() === true.toString());
        this.errorMessage = process.env.MUSEBOT_ERROR_MESSAGE?.trim() || this.errorMessage;

        this.stableDiffusionApiType = process.env.MUSEBOT_STABLE_DIFFUSION_API_TYPE?.trim() as StableDiffusionApiType;
        this.stableDiffusionHosts = process.env.MUSEBOT_STABLE_DIFFUSION_HOSTS?.trim().split(',').map(url => new URL(url)) || [];
        this.stableDiffusionModels = process.env.MUSEBOT_STABLE_DIFFUSION_MODELS?.trim().split(',').filter(x => x.length > 0) || [];

        this.ollamaHosts = process.env.MUSEBOT_OLLAMA_HOSTS?.trim().split(',').map(url => new URL(url)) || [];
        this.ollamaModels = process.env.MUSEBOT_OLLAMA_MODELS?.trim().split(',').filter(x => x.length > 0) || [];
        this.ollamaSystemPrompt = process.env.MUSEBOT_OLLAMA_SYSTEM_PROMPT?.trim() || '';
        this.ollamaStreamsResponse = (process.env.MUSEBOT_OLLAMA_STREAMS_RESPONSE?.trim().toLowerCase() === true.toString());

        this.stableDiffusionOllamaPrompts = process.env.MUSEBOT_EASY_DIFFUSION_OLLAMA_PROMPTS?.split('|') || this.stableDiffusionOllamaPrompts;

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');

        this.#validate();

        this.#logConfiguration();
    }

    #logConfiguration(): void {
        this.#logger(LogLevel.Info, `Package Name: ${this.packageName}`);
        this.#logger(LogLevel.Info, `Package Version: ${this.version}`);
        this.#logger(LogLevel.Info, `NODE_ENV: ${this.nodeEnvironment}`);
        this.#logger(LogLevel.Info, `MUSEBOT_FUNCTION: ${this.botFunction}`);
        this.#logger(LogLevel.Info, `MUSEBOT_DISCORD_CHANNELS: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_REQUIRES_MENTION: ${this.botRequiresMention}`);
        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_API_TYPE: ${this.stableDiffusionApiType}`);
        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_HOSTS: ${this.stableDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_MODELS: ${this.stableDiffusionModels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_HOSTS: ${this.ollamaHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_MODELS: ${this.ollamaModels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_SYSTEM_PROMPT: ${this.ollamaSystemPrompt}`);
        this.#logger(LogLevel.Info, `MUSEBOT_EASY_DIFFUSION_OLLAMA_PROMPTS: ${this.stableDiffusionOllamaPrompts.join(' | ')}`);
    }

    #validate(): void {
        if(this.discordToken.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_TOKEN requires a value.`);
        }

        if(this.stableDiffusionHosts.length === 0) {
            throw new Error(`MUSEBOT_EASY_DIFFUSION_HOSTS requires at least one value.`);
        }

        if(this.stableDiffusionModels.length === 0) {
            this.#logger(LogLevel.Info, 'MUSEBOT_EASY_DIFFUSION_MODELS had no value - a random model will be selected per render.');
        }

        if(this.ollamaHosts.length === 0) {
            throw new Error(`MUSEBOT_OLLAMA_HOSTS requires at least one value.`);
        }

        if(this.ollamaModels.length === 0) {
            this.#logger(LogLevel.Info, 'MUSEBOT_OLLAMA_MODELS had no value - random model selection is not yet supported.');
        }
    }
}
