import { BotFunction } from 'enums/BotFunction';
import { NodeEnvironment } from 'enums/NodeEnvironment';
import { StableDiffusionApiType } from 'services/clients/images/stable-diffusion/enums/StableDiffusionApiType';

export interface IEnvironmentSettings {
    packageName: string;
    version: string;

    nodeEnvironment: NodeEnvironment;

    botFunction: BotFunction;

    maxTaskAttempts: number;

    discordToken: string;
    discordChannels: Array<string>;

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
    errorMessage: string;

    isProduction: boolean;
}
