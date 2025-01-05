import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';

export abstract class ComfyUiBaseTask extends BaseTask {
    comfyUiClient: ComfyUiClient;

    #environmentSettings: IEnvironmentSettings;

    #logger;

    constructor(services: IServiceContainer) {
        super(services);

        this.comfyUiClient = services.comfyUiClient;

        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        const timeoutMs = this.#environmentSettings.taskTimeoutMilliseconds;

        this.#logger(LogLevel.Info, `Registering task timeout of ${timeoutMs}ms.`);

        setTimeout(() => {
            this.taskStatus = TaskStatus.Failed;
        }, timeoutMs);
    }

    override async postProcess(): Promise<void> {
        if(this.taskStatus === TaskStatus.Successful) {
            const taskDurationSeconds = this.#dateToUnixSeconds(new Date()) - this.#dateToUnixSeconds(this.createdTime);
            const newTimeoutMs = taskDurationSeconds * 2 * 1000;

            this.#environmentSettings.taskTimeoutMilliseconds = newTimeoutMs;

            this.#logger(LogLevel.Info, `This task timeout has been adjusted to ${newTimeoutMs}ms based on current performance metrics.`);
        } else if(this.taskStatus === TaskStatus.Failed) {
            this.comfyUiClient.disconnect();
        }
    }

    #dateToUnixSeconds(date: Date) {
        return parseInt((date.getTime() / 1000).toFixed(0));
    }
}
