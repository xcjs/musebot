import { Client as DiscordClient } from 'discord.js';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IBotServiceContainer } from "../../../../IServiceContainer.js"
import { IParallelizationStrategy } from '../../../../parallelization/IParallelizationStrategy.js';
import { ResourceType } from '../../../../parallelization/ResourceType.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';

export class LoginTask extends BaseTask<void> {
    get taskChannel(): string {
        return this.#parallelizationStrategy.getTaskChannel(ResourceType.Chat, this.isChild, null);
    }

    readonly #services: IBotServiceContainer;

    readonly #environmentSettings: IEnvironmentSettings;
    readonly #discordClient: DiscordClient;
    readonly #parallelizationStrategy: IParallelizationStrategy;
    readonly #taskQueue: ITaskQueue;

    constructor(services: IBotServiceContainer) {
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
            this.#taskQueue.add(new LoginTask(this.#services) as BaseTask<unknown>);
        }

        await Promise.resolve();
    }
}
