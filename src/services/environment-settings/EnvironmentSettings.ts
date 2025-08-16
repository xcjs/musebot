import process from 'node:process';

import dotenv from 'dotenv';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../../package.json' with { type: 'json' };
import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { toTitleCase } from '../../utilities/string-utilities.js';
import { StableDiffusionApiType } from '../clients/media/stable-diffusion/enums/StableDiffusionApiType.js';
import { ILogger } from '../ILogger.js';
import { Logger } from '../Logger.js';
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
    discordChannels: string[] = [];
    discordChannelsDisallowed: string[] = [];

    botRequiresMention: boolean = true;
    botResponseRate: number = 100;
    botPrivateMessageUsers: string[] = [];
    errorMessage: string = 'An error occurred while generating a response. Please try again later.';

    stableDiffusionApiType: StableDiffusionApiType;
    stableDiffusionHosts: URL[] = [];
    stableDiffusionModels: string[] = [];
    stableDiffusionGuidanceScaleInterval: number = .5;
    stableDiffusionTaskChannel: string = '';

    ollamaHosts: URL[] = [];
    ollamaModels: string[] = [];
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean = false;
    ollamaTaskChannel: string = '';

    stableDiffusionOllamaPrompts: string[] = ['Describe something or someone with extraordinary detail.'];

    #logger: ILogger;

    get applicationName(): string {
        return toTitleCase(this.packageName);
    }

    get isProduction(): boolean {
        return this.nodeEnvironment === NodeEnvironment.Production;
    }

    constructor() {
        this.#logger = new Logger('EnvironmentSettings');

        // If this loads environment variables during a test, it can pollute
        // the results.
        /* c8 ignore start */
        if(process.env.NODE_ENV !== NodeEnvironment.Test.toString()) {
            dotenv.config();
        }
        /* c8 ignore stop */

        this.packageName = nodePackage.name;
        this.version = nodePackage.version;

        this.nodeEnvironment = this.#readEnum<NodeEnvironment>(EnvironmentKey.NodeEnvironment, Object.values(NodeEnvironment));
        this.botFunction = this.#mapLegacyFunctionsToCurrent(
            this.#readEnum<BotFunction>(EnvironmentKey.BotFunction, Object.values(BotFunction)));

        this.maxTaskAttempts = this.#readDefaultableNumber(EnvironmentKey.TaskQueueMaxAttempts, this.maxTaskAttempts);
        this.taskRetryDelayMilliseconds = this.#readDefaultableNumber(EnvironmentKey.TaskQueueRetryDelayMs, this.taskRetryDelayMilliseconds);

        this.discordToken = this.#readRequiredString(EnvironmentKey.AuthenticationToken);
        this.discordChannels = this.#readDelimitedList(EnvironmentKey.ChatChannels, ',');
        this.discordChannelsDisallowed = this.#readDelimitedList(EnvironmentKey.ChatChannelsDisallowed, ',');

        this.botRequiresMention = this.#readBoolean(EnvironmentKey.BotRequiresMention);
        this.botResponseRate = this.#readDefaultableRangedInteger(EnvironmentKey.BotResponseRate, 1, 100, 100);
        this.botPrivateMessageUsers = this.#readDelimitedList(EnvironmentKey.BotPrivateMessageUsers, ',');
        this.errorMessage = this.#readDefaultableString(EnvironmentKey.BotErrorMessage, this.errorMessage);

        this.stableDiffusionApiType = this.#readEnum<StableDiffusionApiType>
            (EnvironmentKey.StableDiffusionApiType, Object.values(StableDiffusionApiType));

        this.stableDiffusionHosts = this.#readDelimitedList(EnvironmentKey.StableDiffusionHosts, ',')
            .map(x => new URL(x));

        this.stableDiffusionTaskChannel = this.#readDefaultableString(EnvironmentKey.StableDiffusionTaskChannel, this.stableDiffusionTaskChannel);

        this.ollamaHosts = this.#readDelimitedList(EnvironmentKey.OllamaHosts, ',')
            .map(x => new URL(x));

        this.ollamaModels = this.#readDelimitedList(EnvironmentKey.OllamaModels, ',');
        this.ollamaSystemPrompt = this.#readDefaultableString(EnvironmentKey.OllamaSystemPrompt, '');
        this.ollamaStreamsResponse = this.#readBoolean(EnvironmentKey.OllamaStreamsResponse);
        this.ollamaTaskChannel = this.#readDefaultableString(EnvironmentKey.OllamaTaskChannel, this.ollamaTaskChannel);

        this.stableDiffusionOllamaPrompts = this.#readDelimitedList(EnvironmentKey.StableDiffusionOllamaPrompts, '|');

        this.#validate();

        this.#logConfiguration();
    }

    /**
    * Logs the configuration of the application.
    *
    * This method logs various configuration settings to the logger if the current node environment is not `Test`.
    * It includes details such as package name, version, and specific environment variables related to task queues,
    * bot functions, chat channels, stable diffusion API configurations, and more.
    */
    #logConfiguration(): void {
        if(this.nodeEnvironment === NodeEnvironment.Test) {
            return;
        }

        this.#logger.info(`Package Name: ${this.packageName}`);
        this.#logger.info(`Package Version: ${this.version}`);

        this.#logger.info(`${EnvironmentKey.NodeEnvironment}: ${this.nodeEnvironment}`);

        this.#logger.info(`${EnvironmentKey.TaskQueueMaxAttempts}: ${this.maxTaskAttempts}`);
        this.#logger.info(`${EnvironmentKey.TaskQueueRetryDelayMs}: ${this.taskRetryDelayMilliseconds}`);

        this.#logger.info(`${EnvironmentKey.BotFunction}: ${this.botFunction}`);

        this.#logger.info(`${EnvironmentKey.ChatChannels}: ${this.discordChannels.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.ChatChannelsDisallowed}: ${this.discordChannelsDisallowed.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.BotRequiresMention}: ${this.botRequiresMention}`);
        this.#logger.info(`${EnvironmentKey.BotResponseRate}: ${this.botResponseRate}`);
        this.#logger.info(`${EnvironmentKey.BotPrivateMessageUsers}: ${this.botPrivateMessageUsers.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.BotErrorMessage}: ${this.errorMessage}`);

        this.#logger.info(`${EnvironmentKey.StableDiffusionApiType}: ${this.stableDiffusionApiType}`);
        this.#logger.info(`${EnvironmentKey.StableDiffusionHosts}: ${this.stableDiffusionHosts.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.StableDiffusionTaskChannel}: ${this.stableDiffusionTaskChannel}`);

        this.#logger.info(`${EnvironmentKey.OllamaHosts}: ${this.ollamaHosts.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.OllamaModels}: ${this.ollamaModels.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.OllamaSystemPrompt}: ${this.ollamaSystemPrompt}`);
        this.#logger.info(`${EnvironmentKey.OllamaStreamsResponse}: ${this.ollamaStreamsResponse}`);
        this.#logger.info(`${EnvironmentKey.OllamaTaskChannel}: ${this.ollamaTaskChannel}`);

        this.#logger.info(`${EnvironmentKey.StableDiffusionOllamaPrompts}: ${this.stableDiffusionOllamaPrompts.join(' | ')}`);
    }

    /**
    * Validates the configuration settings for the bot.
    *
    * This method checks if the required environment variables are set and throws an error if any of them are missing or invalid.
    * It also logs informational messages if certain configurations are not provided.
    */
    #validate(): void {
        if(this.botFunction === BotFunction.Media && this.stableDiffusionHosts.length === 0) {
            throw new Error(`${EnvironmentKey.StableDiffusionHosts} requires at least one value.`);
        }

        if(this.botFunction === BotFunction.Chat && this.ollamaHosts.length === 0) {
            throw new Error(`${EnvironmentKey.OllamaHosts} requires at least one value.`);
        }

        if(this.ollamaModels.length === 0) {
            this.#logger.error(`${EnvironmentKey.OllamaModels} had no value - random model selection is not yet supported.`);
        }
    }

    /**
    * Reads an environment variable and validates it against a list of enum values.
    *
    * @template T - The type of the enum values.
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @param {T[]} enumValues - An array of enum values to validate against.
    * @returns {T} - The validated value from the environment variable.
    * @throws {Error} - Throws an error if the environment variable is not one of the allowed values.
    */
    #readEnum<T>(key: EnvironmentKey, enumValues: T[]): T {
        const valueString = process.env[key].trim() as T;

        if(!((Object.values(enumValues) as string[]).includes(valueString as string))) {
            throw new Error(`${key} must be one of the following values: ${Object.values(enumValues).join(', ')}`);
        }

        return valueString;
    }

    /**
    * Reads a defaultable number from an environment variable.
    *
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @param {number} defaultValue - The default value to return if the environment variable is not set or cannot be parsed as a number.
    * @returns {number} - The parsed number from the environment variable, or the default value if parsing fails.
    */
    #readDefaultableNumber(key: EnvironmentKey, defaultValue: number): number {
        const value = parseInt(process.env[key]?.trim());

        return isNaN(value)
            ? defaultValue
            : value;
    }

    /**
    * Reads a required environment variable and returns its trimmed value.
    *
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @returns {string} - The trimmed value of the environment variable.
    * @throws {Error} - Throws an error if the environment variable is not provided or is empty.
    */
    #readRequiredString(key: EnvironmentKey): string {
        const value = process.env[key]?.trim() || '';

        if(value.length === 0) {
            throw new Error(`${key} must be provided in the configuration.`);
        }

        return value;
    }

    /**
    * Reads a defaultable string value from the environment.
    *
    * @param {EnvironmentKey} key - The key to look up in the environment variables.
    * @param {string} defaultValue - The default value to return if the environment variable is not set or is empty.
    * @returns {string} - The value of the environment variable, trimmed, or the default value if not set.
    */
    #readDefaultableString(key: EnvironmentKey, defaultValue: string): string {
        return process.env[key]?.trim() || defaultValue;
    }

    /**
    * Reads a delimited list from the environment variables.
    *
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @param {string} separator - The character used to separate items in the list.
    * @returns {string[]} An array of strings, each representing an item in the list. If the environment variable is not set or empty, returns an empty array.
    */
    #readDelimitedList(key: EnvironmentKey, separator: string): string[] {
        const stringValue = process.env[key]?.trim() || null;

        if(stringValue === null || stringValue.length === 0) {
            return [];
        }

        return stringValue.split(separator).map(x => x.trim());
    }

    /**
    * Reads a boolean value from the environment variables.
    *
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @returns {boolean} - The boolean value parsed from the environment variable, or `false` if not found or invalid.
    */
    #readBoolean(key: EnvironmentKey): boolean {
        return (process.env[key]?.trim()
            .toLowerCase() === true.toString());
    }

    /**
    * Reads an environment variable as a defaultable integer.
    *
    * @param {EnvironmentKey} key - The key of the environment variable to read.
    * @param {number} defaultValue - The default value to return if the environment variable is not set or cannot be parsed as an integer.
    * @returns {number} - The parsed integer from the environment variable, or the default value if parsing fails.
    */
    #readDefaultableInteger(key: EnvironmentKey, defaultValue: number): number {
        const value = parseInt(process.env[key]);

        if(isNaN(value)) {
            return defaultValue;
        }

        return value;
    }

    /**
    * Reads an integer from the environment with a default value and ensures it falls within a specified range.
    *
    * @param {EnvironmentKey} key - The key to read from the environment.
    * @param {number} lowerBound - The lower bound of the acceptable range (inclusive).
    * @param {number} upperBound - The upper bound of the acceptable range (inclusive).
    * @param {number} defaultValue - The default value to return if the environment value is not within the range or is undefined.
    * @returns {number} - The integer value from the environment, clamped to the specified range or the default value.
    */
    #readDefaultableRangedInteger(key: EnvironmentKey, lowerBound: number, upperBound: number, defaultValue: number): number {
        const value = this.#readDefaultableInteger(key, defaultValue);

        if(value < lowerBound || value > upperBound) {
            return defaultValue;
        }

        return value;
    }

    /**
     * Maps legacy `BotFunction` values to their modern equivalents (`BotFunction.Chat` or `BotFunction.Media`).
     *
     * This function handles the deprecation of the `Audio`, `Images, and `Text` `BotFunction` values. When encountering
     * either of these legacy values, a warning is logged (unless running in a test environment) indicating that the
     * configuration should be updated to use `Chat` or `Media` instead.
     *
     * @param {BotFunction} botFunction - The `BotFunction` value to map.
     * @returns {BotFunction} The mapped `BotFunction` value.
     */
    #mapLegacyFunctionsToCurrent(botFunction: BotFunction): BotFunction {
        const warningMessage = `The ${EnvironmentKey.BotFunction} value configured has been deprecated and should be `
            + `updated with either ${BotFunction.Chat} or ${BotFunction.Media}.`;

        switch(botFunction) {
            case BotFunction.Audio:
            case BotFunction.Images:
                if(this.nodeEnvironment !== NodeEnvironment.Test) {
                    this.#logger.warn(warningMessage);
                }

                return BotFunction.Media;
            case BotFunction.Text:
                if (this.nodeEnvironment !== NodeEnvironment.Test) {
                    this.#logger.warn(warningMessage);
                }

                return BotFunction.Chat;
            default:
                return botFunction;
        }
    }
}
