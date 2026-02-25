import { Client as DiscordClient } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';

export class LoginTask extends BaseTask<void> {
    get taskChannel(): string {
        return this.#parallelizationStrategy.getTaskChannel(ResourceType.Chat, null);
    }

    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #parallelizationStrategy: IParallelizationStrategy;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);
        this.logger = services.getLogger('LoginTask');

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#parallelizationStrategy = services.parallelizationStrategy;
        this.#taskQueue = services.taskQueue;
    }

    async process(): Promise<void> {
        this.logger.info('Attempting Discord login...');
        await this.#discordClient.login(this.#environmentSettings.discordToken);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            this.logger.warn('Exhausted the maximum attempts for the login task. Adding a new login task to the queue as the application cannot continue otherwise.');
            this.#taskQueue.add(new LoginTask(this.#services));
        }

        await Promise.resolve();
    }
}
