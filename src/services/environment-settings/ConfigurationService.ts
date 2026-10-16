import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { toTitleCase } from '../../utilities/string-utilities.js';
import { LlmModality } from '../clients/llm/enums/LlmModality.js';
import { ILlmHost } from '../clients/llm/models/ILlmHost.js';
import { ILlmModel } from '../clients/llm/models/ILlmModel.js';
import { ILogger } from '../ILogger.js';
import { Logger } from '../Logger.js';
import { ConfigLoader, IAppConfig } from './ConfigLoader.js';
import { IBotConfig } from './IBotConfig.js';
import { IConfigurationService } from './IConfigurationService.js';
import { ILlmModelConfig } from './ILlmModelConfig.js';

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
    return this.#botConfig.chatApis.discord.token;
  }

  get discordChannels(): string[] {
    return this.#botConfig.chatApis.discord.channels
      || [];
  }

  get discordChannelsDisallowed(): string[] {
    return this.#botConfig.chatApis.discord.channelsDisallowed
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
    return this.#botConfig.chatApis.discord.privateMessageUsers
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

  get comfyUiTimeoutMinutes(): number {
    return this.#botConfig.comfyUi?.timeoutMinutes ?? 30;
  }

  get comfyUiGuidanceScaleInterval(): number {
    return this.#botConfig.comfyUi?.guidanceScaleInterval ?? 0.5;
  }

  get randomPrompts(): string[] {
    return this.#botConfig.multiModal?.randomPrompts
      ?? ['Describe something or someone with extraordinary detail.'];
  }

  readonly #modalityLookup: Map<string, LlmModality> = new Map(
    Object.values(LlmModality).map((modality): [string, LlmModality] => [String(modality).toLowerCase(), modality])
  );

  readonly #warnedRootHosts = new Set<string>();

  get llmHosts(): ILlmHost[] {
    return (this.#botConfig.llm?.hosts
      || []).map(host => {
        if (typeof host === 'string') {
          throw new Error('Bare-string hosts are no longer supported; wrap each host as { "url": "..." }. See docs/musebot/04-migration-v10.md.');
        }
        const url = new URL(host.url);

        if (url.pathname === '/' && !this.#warnedRootHosts.has(url.toString())) {
          this.#warnedRootHosts.add(url.toString());
          this.#log.warn(`LLM host '${url}' has no route path. Requests will target '${url}chat/completions'. OpenAI-compatible platforms normally require a versioned route such as '/v1' in the host URL. See config.example.jsonc.`);
        }

        return {
          url,
          token: host.token ?? null,
          isLocal: host.isLocal ?? null
        };
      });
  }

  get llmModels(): string[] {
    return this.llmModelConfigs.map(model => model.name);
  }

  get llmModelConfigs(): ILlmModel[] {
    return (this.#botConfig.llm?.models ?? []).map(model => {
      const config: ILlmModelConfig = typeof model === 'string'
        ? { name: model }
        : model;

      return {
        name: config.name,
        inputModalities: (config.inputModalities ?? [LlmModality.Text]).map(m => this.#toLlmModality(m)),
        outputModalities: (config.outputModalities ?? [LlmModality.Text]).map(m => this.#toLlmModality(m))
      };
    });
  }

  #toLlmModality(value: LlmModality): LlmModality {
    const modality = this.#modalityLookup.get(String(value).trim().toLowerCase());

    if (modality === undefined) {
      throw new Error(`Unknown LLM model modality '${value}'. Valid modalities (case-insensitive): ${Object.values(LlmModality).join(', ')}.`);
    }

    return modality;
  }

  get llmSystemPrompt(): string {
    const prompt = this.#botConfig.llm?.systemPrompt;
    if (Array.isArray(prompt)) {
      return prompt.join('\n');
    }
    return prompt || '';
  }

  get llmStreamsResponse(): boolean {
    return this.#botConfig.llm?.streamsResponse
      ?? false;
  }

  get llmEmbeddingModel(): string | null {
    return this.#botConfig.llm?.embeddingModel
      ?? null;
  }

  get llmVisionModels(): string[] {
    return this.#botConfig.llm?.visionModels
      ?? [];
  }

  get llmTopK(): number {
    return this.#botConfig.llm?.topK
      ?? 5;
  }

  get llmContextWindow(): number | null {
    return this.#botConfig.llm?.contextWindow ?? null;
  }

  get llmContextCompressionThreshold(): number {
    return this.#botConfig.llm?.contextCompressionThreshold ?? 0.75;
  }

  get llmEmbeddingInputLimit(): number {
    return this.#botConfig.llm?.embeddingInputLimit
      ?? 2000;
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
      if (!this.llmHosts || this.llmHosts.length === 0) {
        throw new Error('Chat mode requires at least one LLM host configured in llm.hosts.');
      }
      if (!this.llmModels || this.llmModels.length === 0) {
        console.warn('[ConfigurationService] Warning: Chat mode has no LLM models configured. Model selection not yet supported.');
      }
    } else if (mode === BotMode.Media) {
      if (!this.comfyUiHosts || this.comfyUiHosts.length === 0) {
        throw new Error('Media mode requires at least one ComfyUI host configured in comfyUi.hosts.');
      }
    } else {
      throw new Error(`Invalid mode: ${mode as string}. Must be 'chat' or 'media'.`);
    }

    if (this.taskQueueStrategy === TaskQueueStrategy.Serial && this.llmHosts.some(host => host.isLocal === false)) {
      console.info('[ConfigurationService] Note: Task queue strategy is serial and at least one LLM host is non-local; model-unload waiting is skipped for non-local hosts.');
    }
  }

  #logConfiguration(): void {
    if (this.nodeEnvironment === NodeEnvironment.Test) {
      return;
    }

    this.#log.info(`bots[].botId: ${this.botId}`);
    this.#log.info(`bots[].nodeEnvironment: ${this.nodeEnvironment}`);
    this.#log.info(`bots[].mode: ${this.botFunction}`);

    this.#log.info(`bots[].chatApis.discord.channels: ${this.discordChannels.join(', ')}`);
    this.#log.info(`bots[].chatApis.discord.channelsDisallowed: ${this.discordChannelsDisallowed.join(', ')}`);
    this.#log.info(`bots[].requiresMention: ${this.botRequiresMention}`);
    this.#log.info(`bots[].responseRate: ${this.botResponseRate}`);
    this.#log.info(`bots[].chatApis.discord.privateMessageUsers: ${this.botPrivateMessageUsers.join(', ')}`);
    this.#log.info(`bots[].errorMessage: ${this.errorMessage}`);

    this.#log.info(`bots[].taskQueue.numAttempts: ${this.maxTaskAttempts}`);
    this.#log.info(`bots[].taskQueue.retryDelayMs: ${this.taskRetryDelayMilliseconds}`);
    this.#log.info(`bots[].taskQueue.strategy: ${this.taskQueueStrategy}`);
    this.#log.info(`bots[].taskQueue.forceSerialAcrossHosts: ${this.taskQueueForceSerialAcrossHosts}`);

    this.#log.info(`bots[].comfyUi.hosts: ${this.comfyUiHosts.join(', ')}`);
    this.#log.info(`bots[].comfyUi.timeoutMinutes: ${this.comfyUiTimeoutMinutes}`);
    this.#log.info(`bots[].comfyUi.guidanceScaleInterval: ${this.comfyUiGuidanceScaleInterval}`);

    this.#log.info(`bots[].llm.hosts: ${this.llmHosts.map(host => host.url.toString()).join(', ')}`);
    this.#log.info(`bots[].llm.models: ${this.llmModels.join(', ')}`);
    this.#log.info(`bots[].llm.models.modalities: ${this.llmModelConfigs.map(model => `${model.name} (in: ${model.inputModalities.join('/')} out: ${model.outputModalities.join('/')})`).join(', ')}`);
    this.#log.info(`bots[].llm.systemPrompt: ${this.llmSystemPrompt}`);
    this.#log.info(`bots[].llm.streamsResponse: ${this.llmStreamsResponse}`);
    this.#log.info(`bots[].llm.embeddingModel: ${this.llmEmbeddingModel ?? '(not set)'}`);
    this.#log.info(`bots[].llm.visionModels: ${this.llmVisionModels.join(', ')}`);
    this.#log.info(`bots[].llm.topK: ${this.llmTopK}`);
    this.#log.info(`bots[].llm.contextWindow: ${this.llmContextWindow ?? '(not set)'}`);
    this.#log.info(`bots[].llm.contextCompressionThreshold: ${this.llmContextCompressionThreshold}`);
    this.#log.info(`bots[].llm.embeddingInputLimit: ${this.llmEmbeddingInputLimit}`);

    this.#log.info(`bots[].multiModal.randomPrompts: ${this.randomPrompts.join(' | ')}`);

    this.#log.info('Configuration loaded successfully');
  }

  getConfig(): IAppConfig {
    return JSON.parse(JSON.stringify(this.#config)) as IAppConfig;
  }
}