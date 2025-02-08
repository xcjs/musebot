import process from 'node:process';

import dotenv from 'dotenv';
import { Logger, LogLevel } from 'meklog';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../../package.json' with { type: 'json' };
import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { StableDiffusionApiType } from '../clients/images/stable-diffusion/enums/StableDiffusionApiType.js';
import { EnvironmentKey } from './constants/EnvironmentKey.js';
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
        // If this loads environment variables during a test, it can pollute
        // the results.
        /* c8 ignore start */
        if(process.env.NODE_ENV !== NodeEnvironment.Test) {
            dotenv.config();
        }
        /* c8 ignore stop */

        this.packageName = nodePackage.name;
        this.version = nodePackage.version;

        this.nodeEnvironment = process.env[EnvironmentKey.NodeEnvironment].trim() as NodeEnvironment;

        this.botFunction = process.env[EnvironmentKey.BotFunction].trim() as BotFunction;

        this.maxTaskAttempts = process.env[EnvironmentKey.TaskQueueMaxAttempts]
            ? parseInt(process.env[EnvironmentKey.TaskQueueMaxAttempts])
            : this.maxTaskAttempts;

        this.taskRetryDelayMilliseconds = process.env[EnvironmentKey.TaskQueueRetryDelayMs]
            ? parseInt(process.env[EnvironmentKey.TaskQueueRetryDelayMs])
            : this.taskRetryDelayMilliseconds;

        this.discordToken = process.env[EnvironmentKey.AuthenticationToken]?.trim() || '';

        const discordChannels = process.env[EnvironmentKey.ChatChannels]?.trim() || null;

        if(discordChannels !== null && discordChannels.length > 0) {
            this.discordChannels = discordChannels.trim().split(',') || [];
        }

        const discordChannelsDisallowed = process.env[EnvironmentKey.ChatChannelsDisallowed]?.trim() || null;

        if (discordChannelsDisallowed !== null && discordChannelsDisallowed.length > 0) {
            this.discordChannelsDisallowed = discordChannelsDisallowed.trim().split(',') || [];
        }

        this.botRequiresMention = (process.env[EnvironmentKey.BotRequiresMention]?.trim()
            .toLowerCase() === true.toString());

        const responseRate = parseInt(process.env[EnvironmentKey.BotResponseRate]);
        this.botResponseRate = !isNaN(responseRate) && responseRate > 0 && responseRate <= 100
            ? responseRate
            : this.botResponseRate;

        this.errorMessage = process.env[EnvironmentKey.BotErrorMessage]?.trim() || this.errorMessage;

        this.stableDiffusionApiType = process.env[EnvironmentKey.StableDiffusionApiType]?.trim() as StableDiffusionApiType;

        const stableDiffusionHosts = process.env[EnvironmentKey.StableDiffusionHosts]?.trim() || null;

        if (stableDiffusionHosts !== null && stableDiffusionHosts.length > 0) {
            this.stableDiffusionHosts = stableDiffusionHosts.split(',').map(url => new URL(url)) || [];
        }

        // If the ComfyUI integration is configured, workflows will be loaded
        // from the $PWD/workflows directory and the
        // MUSEBOT_STABLE_DIFFUSION_MODELS environment variable will be ignored.
        //
        // Otherwise, load the environment variable as normal.
        if (this.stableDiffusionApiType !== StableDiffusionApiType.ComfyUI) {
            this.stableDiffusionModels = process.env[EnvironmentKey.StableDiffusionModels]?.trim()
                .split(',')
                .map(x => x.trim())
                .filter(x => x.length > 0) || [];
        }

        const ollamaHosts = process.env[EnvironmentKey.OllamaHosts]?.trim() || null;

        if(ollamaHosts !== null && ollamaHosts.length > 0) {
            this.ollamaHosts = ollamaHosts.split(',').map(url => new URL(url)) || [];
        }

        this.ollamaModels = process.env[EnvironmentKey.OllamaModels]?.trim()
            .split(',')
            .filter(x => x.length > 0) || [];

        this.ollamaSystemPrompt = process.env[EnvironmentKey.OllamaSystemPrompt]?.trim() || '';

        this.ollamaStreamsResponse = (process.env[EnvironmentKey.OllamaStreamsResponse]?.trim()
            .toLowerCase() === true.toString());

        this.stableDiffusionOllamaPrompts = process.env[EnvironmentKey.StableDiffusionOllamaPrompts]?.split('|')
            || this.stableDiffusionOllamaPrompts;

        this.#logger = new Logger(this.isProduction, 'EnvironmentSettings');

        this.#validate();

        this.#logConfiguration();
    }

    #logConfiguration(): void {
        if(this.nodeEnvironment === NodeEnvironment.Test) {
            return;
        }

        this.#logger(LogLevel.Info, `Package Name: ${this.packageName}`);
        this.#logger(LogLevel.Info, `Package Version: ${this.version}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.NodeEnvironment}: ${this.nodeEnvironment}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.TaskQueueMaxAttempts}: ${this.maxTaskAttempts}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.TaskQueueRetryDelayMs}}: ${this.taskRetryDelayMilliseconds}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.BotFunction}: ${this.botFunction}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.ChatChannels}: ${this.discordChannels.join(', ')}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.ChatChannelsDisallowed}: ${this.discordChannelsDisallowed.join(', ')}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.BotRequiresMention}: ${this.botRequiresMention}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.BotResponseRate}: ${this.botResponseRate}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.BotErrorMessage}: ${this.errorMessage}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.StableDiffusionApiType}: ${this.stableDiffusionApiType}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.StableDiffusionHosts}: ${this.stableDiffusionHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.StableDiffusionModels}: ${this.stableDiffusionModels.join(', ')}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.OllamaHosts}: ${this.ollamaHosts.join(', ')}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.OllamaModels}: ${this.ollamaModels.join(', ')}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.OllamaSystemPrompt}: ${this.ollamaSystemPrompt}`);
        this.#logger(LogLevel.Info, `${EnvironmentKey.OllamaStreamsResponse}: ${this.ollamaStreamsResponse}`);

        this.#logger(LogLevel.Info, `${EnvironmentKey.StableDiffusionOllamaPrompts}: ${this.stableDiffusionOllamaPrompts.join(' | ')}`);
    }

    #validate(): void {
        if(!Object.values(BotFunction).includes(this.botFunction)) {
            throw new Error(`${EnvironmentKey.BotFunction} must be one of the following values: ${Object.values(BotFunction).join(', ')}`);
        }

        if(isNaN(this.maxTaskAttempts)) {
            throw new Error(`${EnvironmentKey.TaskQueueMaxAttempts} must be a number.`);
        }

        if(isNaN(this.taskRetryDelayMilliseconds)) {
            throw new Error(`${EnvironmentKey.TaskQueueRetryDelayMs} must be a number.`);
        }

        if(this.discordToken.length === 0) {
            throw new Error(`${EnvironmentKey.AuthenticationToken} requires a value.`);
        }

        if(this.botFunction === BotFunction.Images && this.stableDiffusionHosts.length === 0) {
            throw new Error(`${EnvironmentKey.StableDiffusionHosts} requires at least one value.`);
        }

        if (this.botFunction === BotFunction.Images &&
            !Object.values(StableDiffusionApiType).includes(this.stableDiffusionApiType)) {
            throw new Error(`${EnvironmentKey.StableDiffusionApiType} must be one of the following values: ${Object.values(StableDiffusionApiType).join(', ')}`);
        }

        if(this.stableDiffusionModels.length === 0) {
            this.#logger(LogLevel.Info,
                `${EnvironmentKey.StableDiffusionModels} had no value - a random model will be selected per render.`);
        }

        if(this.botFunction === BotFunction.Text && this.ollamaHosts.length === 0) {
            throw new Error(`${EnvironmentKey.OllamaHosts} requires at least one value.`);
        }

        if(this.ollamaModels.length === 0) {
            this.#logger(LogLevel.Info,
                `${EnvironmentKey.OllamaModels} had no value - random model selection is not yet supported.`);
        }
    }
}
