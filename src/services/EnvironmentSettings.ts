import process from 'node:process';

import dotenv from 'dotenv';
import { Logger, LogLevel } from 'meklog';

import nodePackage from '../../package.json' with { type: 'json' };
import { BotFunction } from '../enums/BotFunction.js';
import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { StableDiffusionApiType } from './clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';

export class EnvironmentSettings implements IEnvironmentSettings {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;

    botFunction: BotFunction;

    maxTaskAttempts: number = 10;
    taskRetryDelayMilliseconds: number = 1000;

    discordToken: string;
    discordChannels: Array<string> = [];
    discordChannelsDisallowed: Array<string> = [];

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
    botResponseRate: number = 100;
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

        this.maxTaskAttempts = process.env.MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS
            ? parseInt(process.env.MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS)
            : this.maxTaskAttempts;

        this.taskRetryDelayMilliseconds = process.env.MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS
            ? parseInt(process.env.MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS)
            : this.taskRetryDelayMilliseconds;

        this.discordToken = process.env.MUSEBOT_DISCORD_TOKEN?.trim() || '';

        const discordChannels = process.env.MUSEBOT_DISCORD_CHANNELS?.trim() || null;

        if(discordChannels !== null && discordChannels.length > 0) {
            this.discordChannels = discordChannels.trim().split(',') || [];
        }

        const discordChannelsDisallowed = process.env.MUSEBOT_DISCORD_CHANNELS_DISALLOWED?.trim() || null;

        if (discordChannelsDisallowed !== null && discordChannelsDisallowed.length > 0) {
            this.discordChannelsDisallowed = discordChannelsDisallowed.trim().split(',') || [];
        }

        this.botRequiresMention = (process.env.MUSEBOT_REQUIRES_MENTION?.trim().toLowerCase() === true.toString());

        const responseRate = parseInt(process.env.MUSEBOT_RESPONSE_RATE);

        this.botResponseRate = !isNaN(responseRate) && responseRate > 0 && responseRate <=100 ? responseRate : this.botResponseRate;

        this.errorMessage = process.env.MUSEBOT_ERROR_MESSAGE?.trim() || this.errorMessage;

        // If the ComfyUI integration is configured, workflows will be loaded
        // from the $PWD/workflows directory and the
        // MUSEBOT_STABLE_DIFFUSION_MODELS environment variable will be ignored.
        //
        // Otherwise, load the environment variable as normal.
        if(this.stableDiffusionApiType !== StableDiffusionApiType.ComfyUI) {
            this.stableDiffusionModels = process.env.MUSEBOT_STABLE_DIFFUSION_MODELS?.trim().split(',').filter(x => x.length > 0) || [];
        }

        const stableDiffusionHosts = process.env.MUSEBOT_STABLE_DIFFUSION_HOSTS?.trim() || null;

        if (stableDiffusionHosts !== null && stableDiffusionHosts.length > 0) {
            this.stableDiffusionHosts = stableDiffusionHosts.split(',').map(url => new URL(url)) || [];
        }

        this.stableDiffusionModels = process.env.MUSEBOT_STABLE_DIFFUSION_MODELS?.trim().split(',').filter(x => x.length > 0) || [];

        const ollamaHosts = process.env.MUSEBOT_OLLAMA_HOSTS?.trim() || null;

        if(ollamaHosts !== null && ollamaHosts.length > 0) {
            this.ollamaHosts = ollamaHosts.split(',').map(url => new URL(url)) || [];
        }

        this.ollamaModels = process.env.MUSEBOT_OLLAMA_MODELS?.trim().split(',').filter(x => x.length > 0) || [];
        this.ollamaSystemPrompt = process.env.MUSEBOT_OLLAMA_SYSTEM_PROMPT?.trim() || '';
        this.ollamaStreamsResponse = (process.env.MUSEBOT_OLLAMA_STREAMS_RESPONSE?.trim().toLowerCase() === true.toString());

        this.stableDiffusionOllamaPrompts = process.env.MUSEBOT_STABLE_DIFFUSION_OLLAMA_PROMPTS?.split('|') || this.stableDiffusionOllamaPrompts;

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');

        this.#validate();

        this.#logConfiguration();
    }

    #logConfiguration(): void {
        this.#logger(LogLevel.Info, `Package Name: ${this.packageName}`);
        this.#logger(LogLevel.Info, `Package Version: ${this.version}`);

        this.#logger(LogLevel.Info, `NODE_ENV: ${this.nodeEnvironment}`);

        this.#logger(LogLevel.Info, `MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS ${this.maxTaskAttempts}`);
        this.#logger(LogLevel.Info, `MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS: ${this.taskRetryDelayMilliseconds}`);

        this.#logger(LogLevel.Info, `MUSEBOT_FUNCTION: ${this.botFunction}`);

        this.#logger(LogLevel.Info, `MUSEBOT_DISCORD_CHANNELS: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_DISCORD_CHANNELS_DISALLOWED: ${this.discordChannelsDisallowed.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_REQUIRES_MENTION: ${this.botRequiresMention}`);
        this.#logger(LogLevel.Info, `MUSEBOT_RESPONSE_RATE: ${this.botResponseRate}`);
        this.#logger(LogLevel.Info, `MUSEBOT_ERROR_MESSAGE: ${this.errorMessage}`);

        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_API_TYPE: ${this.stableDiffusionApiType}`);
        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_HOSTS: ${this.stableDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_MODELS: ${this.stableDiffusionModels.join(', ')}`);

        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_HOSTS: ${this.ollamaHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_MODELS: ${this.ollamaModels.join(', ')}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_SYSTEM_PROMPT: ${this.ollamaSystemPrompt}`);
        this.#logger(LogLevel.Info, `MUSEBOT_OLLAMA_STREAMS_RESPONSE: ${this.ollamaStreamsResponse}`);

        this.#logger(LogLevel.Info, `MUSEBOT_STABLE_DIFFUSION_OLLAMA_PROMPTS: ${this.stableDiffusionOllamaPrompts.join(' | ')}`);
    }

    #validate(): void {
        if(this.discordToken.length === 0) {
            throw new Error(`EASY_DIFFUSION_DISCORD_BOT_TOKEN requires a value.`);
        }

        if(this.botFunction === BotFunction.Images && this.stableDiffusionHosts.length === 0) {
            throw new Error(`MUSEBOT_STABLE_DIFFUSION_HOSTS requires at least one value.`);
        }

        if(this.stableDiffusionModels.length === 0) {
            this.#logger(LogLevel.Info, 'MUSEBOT_STABLE_DIFFUSION_MODELS had no value - a random model will be selected per render.');
        }

        if(this.botFunction === BotFunction.Text && this.ollamaHosts.length === 0) {
            throw new Error(`MUSEBOT_OLLAMA_HOSTS requires at least one value.`);
        }

        if(this.ollamaModels.length === 0) {
            this.#logger(LogLevel.Info, 'MUSEBOT_OLLAMA_MODELS had no value - random model selection is not yet supported.');
        }
    }
}
