import { ButtonInteraction, Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IAttachRenderTask } from '../../tasks/IAttachRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiAttachRenderTask extends ComfyUiBaseTask implements IAttachRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #prompt: string;
    #content: string | null;
    #isEdit: boolean;

    #interaction: Message | ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        prompt: string,
        content: string | null = null,
        isEdit: boolean = false) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;
        this.#prompt = prompt;
        this.#content = content;
        this.#isEdit = isEdit;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiAttachRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiAttachRenderTask...');

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.prompt = this.#prompt.trim();
        renderRequest.refreshSeed();

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render(prompt);

        const exchange = {
            request: [renderRequest],
            response: imagesResponse
        };

        let replyTask: ComfyUiReplyTask;

        if(this.#interaction instanceof ButtonInteraction || this.#isEdit) {
            replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, {
                    request: [renderRequest],
                    response: imagesResponse
                },
                this.#content,
                null,
                false);
        } else {
            replyTask = new ComfyUiReplyTask(
                this.#services,
                this.#interaction,
                exchange,
                this.#content);

            await this.#comfyUiReplyService.reply(this.#interaction, exchange, this.#content);
        }

        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if(this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
