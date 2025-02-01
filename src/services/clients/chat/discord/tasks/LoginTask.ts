import { Client as DiscordClient } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
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

    protected logger: Logger;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#taskQueue = services.taskQueue;

        this.logger = new Logger(this.#environmentSettings.isProduction, 'LoginTask');
    }

    async process(): Promise<void> {
        this.logger(LogLevel.Info, 'Attempting Discord login...');
        await this.#discordClient.login(this.#environmentSettings.discordToken);
    }

    async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Dead) {
            this.logger(LogLevel.Warning, 'Exhausted the maximum attempts for the login task. Adding a new login task to the queue as the application cannot continue otherwise.');
            await this.#taskQueue.add(new LoginTask(this.#services));
        }
    }
}
