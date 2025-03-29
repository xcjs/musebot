import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { MAX_FILE_NAME_LENGTH,MAX_TEXT_LINE_LENGTH } from '../../../../../constants/FileConstants.js';
import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { wrapText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { IRandomRenderTask } from '../../tasks/IRandomRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiRandomRenderTask extends ComfyUiBaseTask implements IRandomRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #taskQueue: ITaskQueue;

    #interaction: ButtonInteraction;

    #logger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiRandomRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiRandomRenderTask...');

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

        const ollamaClient = new OllamaClient(this.#services);
        const ollamaPrompt = getRandomArrayEntry(this.#environmentSettings.stableDiffusionOllamaPrompts);
        const ollamaExchange = await ollamaClient.sendMessage(ollamaPrompt, null);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.prompt = ollamaExchange.response.response;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render([prompt]);

        const exchange = {
            request: [renderRequest],
            response: imagesResponse
        };

        const content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol. They present ${this.#interaction.member || 'you'} with this.`;

        const promptBuffer = Buffer.from(wrapText(renderRequest.prompt, MAX_TEXT_LINE_LENGTH).trim(),
            BufferEncoding.UTF8);

        const promptAttachment = new AttachmentBuilder(promptBuffer, {
            name: `${renderRequest.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.md`
        });

        const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, {content, files: [promptAttachment] }, exchange);
        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
