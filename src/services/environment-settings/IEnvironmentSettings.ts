import { BotFunction } from '../../enums/BotFunction.js';
import { NodeEnvironment } from '../../enums/NodeEnvironment.js';
import { StableDiffusionApiType } from '../clients/images/stable-diffusion/enums/StableDiffusionApiType.js';

export interface IEnvironmentSettings {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;

    botFunction: BotFunction;

    maxTaskAttempts: number;
    taskRetryDelayMilliseconds: number;

    discordToken: string;
    discordChannels: Array<string>;
    discordChannelsDisallowed: Array<string>;

    stableDiffusionApiType: StableDiffusionApiType;
    stableDiffusionHosts: Array<URL>;
    stableDiffusionModels: Array<string>;
    stableDiffusionGuidanceScaleInterval: number;

    ollamaHosts: Array<URL>;
    ollamaModels: Array<string>;
    ollamaSystemPrompt: string;
    ollamaStreamsResponse: boolean;

    stableDiffusionOllamaPrompts: Array<string>;

    botRequiresMention: boolean;
    botResponseRate: number;
    errorMessage: string;

    isProduction: boolean;
}
