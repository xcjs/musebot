import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { IGenerativeChatClient } from '../IGenerativeChatClient.js';
import { LoginTask } from './tasks/LoginTask.js';

export class BaseDiscordClient implements IGenerativeChatClient {
    #services: IServiceContainer;
    #environmentSettings: IEnvironmentSettings;
    #taskQueue: ITaskQueue;

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
}
