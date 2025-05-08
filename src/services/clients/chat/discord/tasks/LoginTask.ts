import { Client as DiscordClient } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';

export class LoginTask extends BaseTask {
    get taskChannel(): string {
        return 'Discord';
    }

    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #taskQueue: ITaskQueue;

    protected logger: ILogger;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#taskQueue = services.taskQueue;

        this.logger = services.getLogger('LoginTask');
    }

    async process(): Promise<void> {
        this.logger.info('Attempting Discord login...');
        await this.#discordClient.login(this.#environmentSettings.discordToken);
    }

    override  async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            this.logger.warning('Exhausted the maximum attempts for the login task. Adding a new login task to the queue as the application cannot continue otherwise.');
            this.#taskQueue.add(new LoginTask(this.#services));
        }

        await Promise.resolve();
    }
}
