import { Client as DiscordClient } from 'discord.js';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ILogger } from '../../../ILogger.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { IGenerativeChatClient } from '../IGenerativeChatClient.js';
import { DiscordSlashCommandRegistrar } from './commands/DiscordSlashCommandRegistrar.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { LoginTask } from './tasks/LoginTask.js';

export class BaseDiscordClient implements IGenerativeChatClient {
    get id(): string {
        return this.#id || '';
    }

    get name(): string {
        return this.#name || '';
    }

    #services: IBotServiceContainer;

    #configurationService: IConfigurationService;
    #taskQueue: ITaskQueue;

    #id: string | null;
    #name: string | null;

    protected logger: ILogger;

    constructor(services: IBotServiceContainer) {
        this.#services = services;

        this.#configurationService = services.configurationService;
        this.#taskQueue = services.taskQueue;
        this.logger = services.getLogger('BaseDiscordClient');
    }

    login(): void {
        this.logger.info('Starting client login task...');
        this.#taskQueue.add(new LoginTask(this.#services));
    }

    onClientReady(discordClient: DiscordClient): Promise<void> {
        if (discordClient.user === null) {
            return;
        }

        this.#id = discordClient.user.id;
        this.#name = discordClient.user.displayName;

        this.logger.info(`${this.#configurationService.applicationName} is ready.`);
        discordClient.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });

        const registrar = new DiscordSlashCommandRegistrar(this.#services);
        void registrar.registerCommands(this.#id);
    }
}
