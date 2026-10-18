import { BotMode } from '../../enums/BotMode.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { ILlmHost } from '../clients/llm/models/ILlmHost.js';
import { ILlmModel } from '../clients/llm/models/ILlmModel.js';

export interface IConfigurationService {
  packageName: string;
  version: string;

  nodeEnvironment: NodeEnvironment;
  botId: string;
  botFunction: BotMode;

  discordToken: string;
  discordChannels: string[];
  discordChannelsDisallowed: string[];
  botRequiresMention: boolean;
  botResponseRate: number;
  botPrivateMessageUsers: string[];
  errorMessage: string;

  maxTaskAttempts: number;
  taskRetryDelayMilliseconds: number;
  taskQueueStrategy: TaskQueueStrategy;
  taskQueueForceSerialAcrossHosts: boolean;

  comfyUiHosts: URL[];
  comfyUiGuidanceScaleInterval: number;
  comfyUiTimeoutMinutes: number;
  randomPrompts: string[];

  llmHosts: ILlmHost[];
  llmModels: string[];
  llmModelConfigs: ILlmModel[];
  llmSystemPrompt: string;
  llmStreamsResponse: boolean;
  llmEmbeddingModel: string | null;
  llmTopK: number;

  get llmContextWindow(): number | null;
  get llmContextCompressionThreshold(): number;
  get llmEmbeddingInputLimit(): number;

  applicationName: string;
  isProduction: boolean;
}