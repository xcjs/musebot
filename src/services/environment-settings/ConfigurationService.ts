import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { toTitleCase } from '../../utilities/string-utilities.js';
import { ILogger } from '../ILogger.js';
import { Logger } from '../Logger.js';
import { ConfigLoader, IAppConfig } from './ConfigLoader.js';
import { IBotConfig } from './IBotConfig.js';
import { IConfigurationService } from './IConfigurationService.js';

export class ConfigurationService implements IConfigurationService {
    readonly #loggers: Map<string, ILogger>;
    readonly #botConfig: IBotConfig;
    readonly #config: IAppConfig | null = null;
    readonly #log: ILogger;

    get packageName(): string {
        return 'musebot';
    }

    get version(): string {
        return '8.7.1';
    }

    get nodeEnvironment(): NodeEnvironment {
        return this.#botConfig.nodeEnvironment as NodeEnvironment
            || NodeEnvironment.Production;
    }

    get botFunction(): BotMode {
        return this.#botConfig.mode;
    }

    get botId(): string {
        return this.#botConfig.botId;
    }

    get maxTaskAttempts(): number {
        return this.#botConfig.taskQueue?.numAttempts
            || this.#config?.global?.taskQueue?.numAttempts
            || 10;
    }

    get taskRetryDelayMilliseconds(): number {
        return this.#botConfig.taskQueue?.retryDelayMs
            || this.#config?.global?.taskQueue?.retryDelayMs
            || 1000;
    }

    get taskQueueStrategy(): TaskQueueStrategy {
        return this.#botConfig.taskQueue?.strategy
            || this.#config?.global?.taskQueue?.strategy
            || TaskQueueStrategy.Serial;
    }

    get taskQueueForceSerialAcrossHosts(): boolean {
        return this.#botConfig.taskQueue?.forceSerialAcrossHosts
            ?? this.#config?.global?.taskQueue?.forceSerialAcrossHosts
            ?? false;
    }

    get discordToken(): string {
        return this.#botConfig.chatApis?.discord?.token
            || this.#botConfig.discord?.token;
    }

    get discordChannels(): string[] {
        return this.#botConfig.chatApis?.discord?.channels
            || this.#botConfig.discord?.channels
            || [];
    }

    get discordChannelsDisallowed(): string[] {
        return this.#botConfig.discord?.channelsDisallowed
            || [];
    }

    get botRequiresMention(): boolean {
        return this.#botConfig.requiresMention ?? true;
    }

    get botResponseRate(): number {
        return this.#botConfig.responseRate
            || 100;
    }

    get botPrivateMessageUsers(): string[] {
        return this.#botConfig.chatApis?.discord?.privateMessageUsers
            || this.#botConfig.discord?.privateMessageUsers
            || [];
    }

    get errorMessage(): string {
        return this.#botConfig.errorMessage
            || 'An error occurred while processing your request. Please try again later.';
    }

    get comfyUiHosts(): URL[] {
        return (this.#botConfig.comfyUi?.hosts
            || []).map(x => new URL(x));
    }

    get comfyUiGuidanceScaleInterval(): number {
        return this.#botConfig.comfyUiGuidanceScaleInterval ?? 0.5;
    }

    get comfyUiOllamaPrompts(): string[] {
        return this.#botConfig.comfyUiOllamaPrompts
            ?? this.#botConfig.multiModal?.randomPrompts
            ?? ['Describe something or someone with extraordinary detail.'];
    }

    get ollamaHosts(): URL[] {
        return (this.#botConfig.ollama?.hosts
            || []).map(x => new URL(x));
    }

    get ollamaModels(): string[] {
        return this.#botConfig.ollama?.models
            || [];
    }

    get ollamaSystemPrompt(): string {
        return this.#botConfig.ollama?.systemPrompt
            || '';
    }

    get ollamaStreamsResponse(): boolean {
        return this.#botConfig.ollama?.streamsResponse
            ?? false;
    }

    get applicationName(): string {
        return toTitleCase(this.packageName);
    }

    get isProduction(): boolean {
        return this.nodeEnvironment === NodeEnvironment.Production;
    }

    constructor(botConfig: IBotConfig) {
        this.#loggers = new Map();
        this.#botConfig = botConfig;

        this.#log = new Logger('ConfigurationService', botConfig.botId);

        this.#config = ConfigLoader.load();

        this.#validateMusebotEnvVars();
        this.#validateMode();

        this.#logConfiguration();
    }

    #validateMusebotEnvVars(): void {
        const musebotEnvVars = Object.keys(process.env).filter(key => key.startsWith('MUSEBOT_'));

        if (musebotEnvVars.length > 0) {
            const envVarList = musebotEnvVars.join(', ');
            throw new Error(`[ConfigurationService] FATAL ERROR: .env support has been removed. Please migrate all environment variables to config.jsonc format.

Migration guide: docs/migration-from-env-to-jsonc.md

Detected environment variables: ${envVarList}`);
        }
    }

    #validateMode(): void {
        const mode = this.botFunction;

        if (mode === BotMode.Chat) {
            if (!this.ollamaHosts || this.ollamaHosts.length === 0) {
                throw new Error('Chat mode requires at least one Ollama host configured in ollama.hosts.');
            }
            if (!this.ollamaModels || this.ollamaModels.length === 0) {
                console.warn('[ConfigurationService] Warning: Chat mode has no Ollama models configured. Model selection not yet supported.');
            }
        } else if (mode === BotMode.Media) {
            if (!this.comfyUiHosts || this.comfyUiHosts.length === 0) {
                throw new Error('Media mode requires at least one ComfyUI host configured in comfyUi.hosts.');
            }
        } else {
            throw new Error(`Invalid mode: ${mode as string}. Must be 'chat' or 'media'.`);
        }
    }

    #logConfiguration(): void {
        if (this.nodeEnvironment === NodeEnvironment.Test) {
            return;
        }

        this.#log.info(`bots[].botId: ${this.botId}`);
        this.#log.info(`bots[].nodeEnvironment: ${this.nodeEnvironment}`);
        this.#log.info(`bots[].mode: ${this.botFunction}`);

        this.#log.info(`bots[].discord.channels: ${this.discordChannels.join(', ')}`);
        this.#log.info(`bots[].discord.channelsDisallowed: ${this.discordChannelsDisallowed.join(', ')}`);
        this.#log.info(`bots[].requiresMention: ${this.botRequiresMention}`);
        this.#log.info(`bots[].responseRate: ${this.botResponseRate}`);
        this.#log.info(`bots[].discord.privateMessageUsers: ${this.botPrivateMessageUsers.join(', ')}`);
        this.#log.info(`bots[].errorMessage: ${this.errorMessage}`);

        this.#log.info(`bots[].taskQueue.numAttempts: ${this.maxTaskAttempts}`);
        this.#log.info(`bots[].taskQueue.retryDelayMs: ${this.taskRetryDelayMilliseconds}`);
        this.#log.info(`bots[].taskQueue.strategy: ${this.taskQueueStrategy}`);
        this.#log.info(`bots[].taskQueue.forceSerialAcrossHosts: ${this.taskQueueForceSerialAcrossHosts}`);

        this.#log.info(`bots[].comfyUi.hosts: ${this.comfyUiHosts.join(', ')}`);
        this.#log.info(`bots[].comfyUiGuidanceScaleInterval: ${this.comfyUiGuidanceScaleInterval}`);

        this.#log.info(`bots[].ollama.hosts: ${this.ollamaHosts.join(', ')}`);
        this.#log.info(`bots[].ollama.models: ${this.ollamaModels.join(', ')}`);
        this.#log.info(`bots[].ollama.systemPrompt: ${this.ollamaSystemPrompt}`);
        this.#log.info(`bots[].ollama.streamsResponse: ${this.ollamaStreamsResponse}`);

        this.#log.info(`bots[].comfyUiOllamaPrompts: ${this.comfyUiOllamaPrompts.join(' | ')}`);

        this.#log.info('Configuration loaded successfully');
    }

    getConfig(): IAppConfig {
        return JSON.parse(JSON.stringify(this.#config)) as IAppConfig;
    }
}