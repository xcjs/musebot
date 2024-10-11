import { BotFunction } from 'enums/BotFunction.js';
import { ServiceContainer } from 'services/ServiceContainer.js';
import { BaseDiscordClient } from 'services/clients/chat/discord/BaseDiscordClient.js';
import { DiscordAutomatic1111Client } from 'services/clients/chat/discord/automatic1111/DiscordAutomatic1111Client.js';
import { DiscordEasyDiffusionClient } from 'services/clients/chat/discord/easy-diffusion/DiscordEasyDiffusionClient.js';
import { DiscordOllamaClient } from 'services/clients/chat/discord/ollama/DiscordOllamaClient.js';
import { StableDiffusionApiType } from 'services/clients/images/stable-diffusion/enums/StableDiffusionApiType.js';

const services = new ServiceContainer();
const environmentSettings = services.environmentSettings;

let client: BaseDiscordClient;

switch(environmentSettings.botFunction) {
    case BotFunction.Images:
        switch(environmentSettings.stableDiffusionApiType) {
            case StableDiffusionApiType.Automatic1111:
                client = new DiscordAutomatic1111Client(services);
                break;
                case StableDiffusionApiType.EasyDiffusion:
                client = new DiscordEasyDiffusionClient(services);
                break;
        }
        break;
    case BotFunction.Text:
        client = new DiscordOllamaClient(services);
        break;
}

client.login();
