import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export abstract class ComfyUiBaseTask extends BaseTask {
    comfyUiClient: ComfyUiClient;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;

    #logger;

    constructor(services: IServiceContainer) {
        super(services);

        this.comfyUiClient = services.comfyUiClient;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiBaseTask');
    }

    override async process(): Promise<void> {
        await super.process();
        await this.#workflowService.loadWorkflows();
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Successful) {
            const taskDurationSeconds = this.#dateToUnixSeconds(new Date()) - this.#dateToUnixSeconds(this.startedTime);
            const currentTimeoutMs = this.#environmentSettings.taskTimeoutMilliseconds;
            const newTimeoutMs = Math.floor(currentTimeoutMs + (taskDurationSeconds * 2 * 1000) / 2);

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
