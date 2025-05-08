import { Client as DiscordClient } from 'discord.js';

import { APPLICATION_NAME } from '../../../../constants/Globals.js';
import { ILogger } from '../../../ILogger.js';
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
    #taskQueue: ITaskQueue;

    #id: string | null;
    #name: string | null;

    protected logger: ILogger;

    constructor(services: IServiceContainer) {
        this.#services = services;

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

        this.logger.info(`${APPLICATION_NAME} is ready.`);
        discordClient.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }
}
