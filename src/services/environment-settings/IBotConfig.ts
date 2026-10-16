import { BotMode } from '../../enums/BotMode.js';
import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';
import { ILlmHostConfig } from './ILlmHostConfig.js';
import { ILlmModelConfig } from './ILlmModelConfig.js';

export interface IBotConfig {
  botId: string;
  nodeEnvironment: string;
  mode: BotMode;

  requiresMention?: boolean;
  responseRate?: number;
  errorMessage?: string;

  chatApis: {
    discord: {
      token: string;
      channels: string[];
      privateMessageUsers: string[];
      channelsDisallowed?: string[];
    };
  };

  comfyUi: {
    hosts: string[];
    timeoutMinutes?: number;
    guidanceScaleInterval?: number;
  };

  llm: {
    hosts: ILlmHostConfig[];
    models: Array<string | ILlmModelConfig>;
    systemPrompt: string | string[];
    streamsResponse: boolean;
    embeddingModel?: string;
    embeddingInputLimit?: number;
    visionModels?: string[];
    topK?: number;
    contextWindow?: number;
    contextCompressionThreshold?: number;
  };

  multiModal?: {
    randomPrompts: string[];
  };

  taskQueue?: {
    numAttempts?: number;
    retryDelayMs?: number;
    strategy?: TaskQueueStrategy;
    forceSerialAcrossHosts?: boolean;
  };
}