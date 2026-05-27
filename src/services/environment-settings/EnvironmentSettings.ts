import * as fs from 'node:fs';
import process, { loadEnvFile } from 'node:process';

// Below is required to prevent ts-jest from throwing an error regarding
// hybrid module resolution, which we are not using. It's all NodeNext.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import nodePackage from '../../../package.json' with { type: 'json' };
import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { toTitleCase } from '../../utilities/string-utilities.js';
import { ILogger } from '../ILogger.js';
import { Logger } from '../Logger.js';
import { EnvironmentKey } from './constants/EnvironmentKey.js';
import { IBotConfig } from './IBotConfig.js';
import { IEnvironmentSettings } from './IEnvironmentSettings.js';

export class EnvironmentSettings implements IEnvironmentSettings {
    readonly #packageName: string;
    get packageName(): string {
        return this.#packageName;
    }

    readonly #version: string;
    get version(): string {
        return this.#version;
    }

    readonly #nodeEnvironment: NodeEnvironment;
    get nodeEnvironment(): NodeEnvironment {
        return this.#nodeEnvironment;
    }

    readonly #botFunction: BotFunction;
    get botFunction(): BotFunction {
        return this.#botFunction;
    }

    readonly #maxTaskAttempts: number = 10;
    get maxTaskAttempts(): number {
        return this.#maxTaskAttempts;
    }

    readonly #taskRetryDelayMilliseconds: number = 1000;
    get taskRetryDelayMilliseconds(): number {
        return this.#taskRetryDelayMilliseconds;
    }

    readonly #taskQueueStrategy: TaskQueueStrategy;
    get taskQueueStrategy(): TaskQueueStrategy {
        return this.#taskQueueStrategy;
    }

    readonly #taskQueueForceSerialAcrossHosts: boolean = false;
    get taskQueueForceSerialAcrossHosts(): boolean {
        return this.#taskQueueForceSerialAcrossHosts;
    }

    readonly #discordToken: string;
    get discordToken(): string {
        return this.#discordToken;
    }

    readonly #discordChannels: string[] = [];
    get discordChannels(): string[] {
        return this.#discordChannels;
    }

    readonly #discordChannelsDisallowed: string[] = [];
    get discordChannelsDisallowed(): string[] {
        return this.#discordChannelsDisallowed;
    }

    readonly #botRequiresMention: boolean = true;
    get botRequiresMention(): boolean {
        return this.#botRequiresMention;
    }

    readonly #botResponseRate: number = 100;
    get botResponseRate(): number {
        return this.#botResponseRate;
    }

    readonly #botPrivateMessageUsers: string[] = [];
    get botPrivateMessageUsers(): string[] {
        return this.#botPrivateMessageUsers;
    }

    readonly #errorMessage: string = 'An error occurred while generating a response. Please try again later.';
    get errorMessage(): string {
        return this.#errorMessage;
    }

    readonly #stableDiffusionHosts: URL[] = [];
    get stableDiffusionHosts(): URL[] {
        return this.#stableDiffusionHosts;
    }

    readonly #stableDiffusionGuidanceScaleInterval: number = .5;
    get stableDiffusionGuidanceScaleInterval(): number {
        return this.#stableDiffusionGuidanceScaleInterval;
    }

    readonly #ollamaHosts: URL[] = [];
    get ollamaHosts(): URL[] {
        return this.#ollamaHosts;
    }

    readonly #ollamaModels: string[] = [];
    get ollamaModels(): string[] {
        return this.#ollamaModels;
    }

    readonly #ollamaSystemPrompt: string;
    get ollamaSystemPrompt(): string {
        return this.#ollamaSystemPrompt;
    }

    readonly #ollamaStreamsResponse: boolean = false;
    get ollamaStreamsResponse(): boolean {
        return this.#ollamaStreamsResponse;
    }

    readonly #stableDiffusionOllamaPrompts: string[] = ['Describe something or someone with extraordinary detail.'];
    get stableDiffusionOllamaPrompts(): string[] {
        return this.#stableDiffusionOllamaPrompts;
    }

    readonly #logger: ILogger;

    get applicationName(): string {
        return toTitleCase(this.packageName);
    }

    get isProduction(): boolean {
        return this.nodeEnvironment === NodeEnvironment.Production;
    }

    constructor(config?: IBotConfig) {
        this.#logger = new Logger('EnvironmentSettings');

        // If this loads environment variables during a test, it can pollute
        // the results.
        /* c8 ignore start */
        if(process.env.NODE_ENV !== NodeEnvironment.Test.toString()
            && fs.existsSync('./.env')) {
            loadEnvFile();
        }
        /* c8 ignore stop */

        this.#packageName = nodePackage.name;
        this.#version = nodePackage.version;

        this.#nodeEnvironment = config?.nodeEnvironment
            ? (config.nodeEnvironment as NodeEnvironment)
            : this.#readEnum<NodeEnvironment>(EnvironmentKey.NodeEnvironment, Object.values(NodeEnvironment), NodeEnvironment.Production);
        this.#botFunction = this.#mapLegacyFunctionsToCurrent(
            config?.botFunction
                ? (config.botFunction as BotFunction)
                : this.#readEnum<BotFunction>(EnvironmentKey.BotFunction, Object.values(BotFunction), BotFunction.Chat));

        this.#maxTaskAttempts = config?.maxTaskAttempts
            ?? this.#readDefaultableNumber(EnvironmentKey.TaskQueueMaxAttempts, this.maxTaskAttempts);
        this.#taskRetryDelayMilliseconds = config?.taskRetryDelayMilliseconds
            ?? this.#readDefaultableNumber(EnvironmentKey.TaskQueueRetryDelayMs, this.taskRetryDelayMilliseconds);
        this.#taskQueueStrategy = config?.taskQueueStrategy
            ? (config.taskQueueStrategy as TaskQueueStrategy)
            : this.#readEnum(EnvironmentKey.TaskQueueStrategy, Object.values(TaskQueueStrategy), TaskQueueStrategy.Serial);
        this.#taskQueueForceSerialAcrossHosts = config?.taskQueueForceSerialAcrossHosts
            ?? this.#readBoolean(EnvironmentKey.TaskQueueForceSerialAcrossHosts);

        this.#discordToken = config?.discordToken
            ?? this.#readRequiredString(EnvironmentKey.AuthenticationToken);
        this.#discordChannels = config?.discordChannels
            ? this.#parseDelimitedList(config.discordChannels, ',')
            : this.#readDelimitedList(EnvironmentKey.ChatChannels, ',');
        this.#discordChannelsDisallowed = config?.discordChannelsDisallowed
            ? this.#parseDelimitedList(config.discordChannelsDisallowed, ',')
            : this.#readDelimitedList(EnvironmentKey.ChatChannelsDisallowed, ',');

        this.#botRequiresMention = config?.botRequiresMention
            ?? this.#readBoolean(EnvironmentKey.BotRequiresMention);
        this.#botResponseRate = config?.botResponseRate
            ?? this.#readDefaultableRangedInteger(EnvironmentKey.BotResponseRate, 1, 100, 100);
        this.#botPrivateMessageUsers = config?.botPrivateMessageUsers
            ? this.#parseDelimitedList(config.botPrivateMessageUsers, ',')
            : this.#readDelimitedList(EnvironmentKey.BotPrivateMessageUsers, ',');
        this.#errorMessage = config?.errorMessage
            ?? this.#readDefaultableString(EnvironmentKey.BotErrorMessage, this.errorMessage);

        this.#stableDiffusionHosts = config?.stableDiffusionHosts
            ? this.#parseDelimitedList(config.stableDiffusionHosts, ',').map(x => new URL(x))
            : this.#readDelimitedList(EnvironmentKey.StableDiffusionHosts, ',').map(x => new URL(x));
        this.#stableDiffusionGuidanceScaleInterval = config?.stableDiffusionGuidanceScaleInterval
            ?? this.stableDiffusionGuidanceScaleInterval;

        this.#ollamaHosts = config?.ollamaHosts
            ? this.#parseDelimitedList(config.ollamaHosts, ',').map(x => new URL(x))
            : this.#readDelimitedList(EnvironmentKey.OllamaHosts, ',').map(x => new URL(x));
        this.#ollamaModels = config?.ollamaModels
            ? this.#parseDelimitedList(config.ollamaModels, ',')
            : this.#readDelimitedList(EnvironmentKey.OllamaModels, ',');
        this.#ollamaSystemPrompt = config?.ollamaSystemPrompt
            ?? this.#readDefaultableString(EnvironmentKey.OllamaSystemPrompt, '');
        this.#ollamaStreamsResponse = config?.ollamaStreamsResponse
            ?? this.#readBoolean(EnvironmentKey.OllamaStreamsResponse);

        this.#stableDiffusionOllamaPrompts = config?.stableDiffusionOllamaPrompts
            ? this.#parseDelimitedList(config.stableDiffusionOllamaPrompts, '|')
            : this.#readDelimitedList(EnvironmentKey.StableDiffusionOllamaPrompts, '|');

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
        this.#logger.info(`${EnvironmentKey.TaskQueueStrategy}: ${this.taskQueueStrategy}`);
        this.#logger.info(`${EnvironmentKey.TaskQueueForceSerialAcrossHosts}: ${this.taskQueueForceSerialAcrossHosts}`);

        this.#logger.info(`${EnvironmentKey.BotFunction}: ${this.botFunction}`);

        this.#logger.info(`${EnvironmentKey.ChatChannels}: ${this.discordChannels.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.ChatChannelsDisallowed}: ${this.discordChannelsDisallowed.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.BotRequiresMention}: ${this.botRequiresMention}`);
        this.#logger.info(`${EnvironmentKey.BotResponseRate}: ${this.botResponseRate}`);
        this.#logger.info(`${EnvironmentKey.BotPrivateMessageUsers}: ${this.botPrivateMessageUsers.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.BotErrorMessage}: ${this.errorMessage}`);

        this.#logger.info(`${EnvironmentKey.StableDiffusionHosts}: ${this.stableDiffusionHosts.join(', ')}`);

        this.#logger.info(`${EnvironmentKey.OllamaHosts}: ${this.ollamaHosts.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.OllamaModels}: ${this.ollamaModels.join(', ')}`);
        this.#logger.info(`${EnvironmentKey.OllamaSystemPrompt}: ${this.ollamaSystemPrompt}`);
        this.#logger.info(`${EnvironmentKey.OllamaStreamsResponse}: ${this.ollamaStreamsResponse}`);

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
    #readEnum<T>(key: EnvironmentKey, enumValues: T[], defaultValue: T): T {
        const valueString = process.env[key]?.trim() as T || defaultValue;

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
        const value = Number.parseInt((process.env[key] || defaultValue.toString()).trim());

        return Number.isNaN(value)
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
    * Parses a delimited string into an array of trimmed values.
    *
    * @param {string} stringValue - The delimited string to parse.
    * @param {string} separator - The character used to separate items in the list.
    * @returns {string[]} An array of strings, each representing an item in the list.
    */
    #parseDelimitedList(stringValue: string, separator: string): string[] {
        const trimmed = stringValue.trim();

        if(trimmed.length === 0) {
            return [];
        }

        return trimmed.split(separator).map(x => x.trim());
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
        const value = Number.parseInt(process.env[key] || defaultValue.toString());

        if(Number.isNaN(value)) {
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
