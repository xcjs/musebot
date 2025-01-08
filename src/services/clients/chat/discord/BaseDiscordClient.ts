import { Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { IGenerativeChatClient } from '../IGenerativeChatClient.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { LoginTask } from './tasks/LoginTask.js';

export class BaseDiscordClient implements IGenerativeChatClient {
    get id(): string {
        return this.#id || '';
    }

    get name(): string {
        return this.#name || '';
    }

    #services: IServiceContainer;
    #environmentSettings: IEnvironmentSettings;
    #taskQueue: ITaskQueue;

    #id: string | null;
    #name: string | null;

    protected logger: Logger;

    constructor(services: IServiceContainer) {
        this.#services = services;
        this.#environmentSettings = services.environmentSettings;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, BaseDiscordClient.name);
    }

    async login(): Promise<void> {
        this.logger(LogLevel.Info, 'Starting client login task...');
        this.#taskQueue.add(new LoginTask(this.#services));
    }

    onClientReady(discordClient: DiscordClient): Promise<void> {
        if (discordClient.user === null) {
            return;
        }

        this.#id = discordClient.user.id;
        this.#name = discordClient.user.displayName;

        this.logger(LogLevel.Info, 'Client is ready.');
        discordClient.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }
}
