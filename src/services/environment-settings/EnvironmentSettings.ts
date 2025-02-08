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

    botRequiresMention: boolean = true;
    botResponseRate: number = 100;
    errorMessage: string = 'An error occurred while generating a response. Please try again later.';

    stableDiffusionApiType: StableDiffusionApiType;
    stableDiffusionHosts: Array<URL> = [];
    stableDiffusionModels: Array<string> = [];
    stableDiffusionGuidanceScaleInterval: number = .5;

    ollamaHosts: Array<URL> = [];
    ollamaModels: Array<string> = [];
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean = false;

    stableDiffusionOllamaPrompts: Array<string> = ['Describe something or someone with extraordinary detail.'];

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

        this.nodeEnvironment = this.#readEnum<NodeEnvironment>(EnvironmentKey.NodeEnvironment, Object.values(NodeEnvironment));
        this.botFunction = this.#readEnum<BotFunction>(EnvironmentKey.BotFunction, Object.values(BotFunction));

        this.maxTaskAttempts = this.#readDefaultableNumber(EnvironmentKey.TaskQueueMaxAttempts, this.maxTaskAttempts);
        this.taskRetryDelayMilliseconds = this.#readDefaultableNumber(EnvironmentKey.TaskQueueRetryDelayMs, this.taskRetryDelayMilliseconds);

        this.discordToken = this.#readRequiredString(EnvironmentKey.AuthenticationToken);
        this.discordChannels = this.#readDelimitedList(EnvironmentKey.ChatChannels, ',');
        this.discordChannelsDisallowed = this.#readDelimitedList(EnvironmentKey.ChatChannelsDisallowed, ',');

        this.botRequiresMention = this.#readBoolean(EnvironmentKey.BotRequiresMention);
        this.botResponseRate = this.#readDefaultableRangedInteger(EnvironmentKey.BotResponseRate, 1, 100, 100);
        this.errorMessage = this.#readDefaultableString(EnvironmentKey.BotErrorMessage, this.errorMessage);

        this.stableDiffusionApiType = this.#readEnum<StableDiffusionApiType>
            (EnvironmentKey.StableDiffusionApiType, Object.values(StableDiffusionApiType));

        this.stableDiffusionHosts = this.#readDelimitedList(EnvironmentKey.StableDiffusionHosts, ',')
            .map(x => new URL(x));

        // If the ComfyUI integration is configured, workflows will be loaded
        // from the $PWD/workflows directory and the
        // MUSEBOT_STABLE_DIFFUSION_MODELS environment variable will be ignored.
        //
        // Otherwise, load the environment variable as normal.
        if (this.stableDiffusionApiType !== StableDiffusionApiType.ComfyUI) {
            this.stableDiffusionModels = this.#readDelimitedList(EnvironmentKey.StableDiffusionModels, ',');
        }

        this.ollamaHosts = this.#readDelimitedList(EnvironmentKey.OllamaHosts, ',')
            .map(x => new URL(x));

        this.ollamaModels = this.#readDelimitedList(EnvironmentKey.OllamaModels, ',');
        this.ollamaSystemPrompt = this.#readDefaultableString(EnvironmentKey.OllamaSystemPrompt, '');
        this.ollamaStreamsResponse = this.#readBoolean(EnvironmentKey.OllamaStreamsResponse);

        this.stableDiffusionOllamaPrompts = this.#readDelimitedList(EnvironmentKey.StableDiffusionOllamaPrompts, '|');

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
            this.#logger(LogLevel.Error,
                `${EnvironmentKey.OllamaModels} had no value - random model selection is not yet supported.`);
        }
    }

    #readEnum<T>(key: EnvironmentKey, enumValues: T[]): T {
        const valueString = process.env[key].trim() as T;

        if(!((Object.values(enumValues) as string[]).includes(valueString as string))) {
            throw new Error(`${key} must be one of the following values: ${Object.values(enumValues).join(', ')}`);
        }

        return valueString;
    }

    #readDefaultableNumber(key: EnvironmentKey, defaultValue: number): number {
        const value = parseInt(process.env[key]?.trim());

        return isNaN(value)
            ? defaultValue
            : value;
    }

    #readRequiredString(key: EnvironmentKey): string {
        const value = process.env[key]?.trim() || '';

        if(value.length === 0) {
            throw new Error(`${key} must be provided in the configuration.`);
        }

        return value;
    }

    #readDefaultableString(key: EnvironmentKey, defaultValue: string): string {
        return process.env[key]?.trim() || defaultValue;
    }

    #readDelimitedList(key: EnvironmentKey, separator: string): string[] {
        const stringValue = process.env[key]?.trim() || null;

        if(stringValue === null || stringValue.length === 0) {
            return [];
        }

        return stringValue.split(separator).map(x => x.trim());
    }

    #readBoolean(key: EnvironmentKey): boolean {
        return (process.env[key]?.trim()
            .toLowerCase() === true.toString());
    }

    #readDefaultableInteger(key: EnvironmentKey, defaultValue: number): number {
        const value = parseInt(process.env[key]);

        if(isNaN(value)) {
            return defaultValue;
        }

        return value;
    }

    #readDefaultableRangedInteger(key: EnvironmentKey, lowerBound: number, upperBound: number, defaultValue: number): number {
        const value = this.#readDefaultableInteger(key, defaultValue);

        if(value < lowerBound || value > upperBound) {
            return defaultValue;
        }

        return value;
    }
}
