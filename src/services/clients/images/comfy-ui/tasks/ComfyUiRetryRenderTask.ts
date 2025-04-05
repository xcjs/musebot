import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction, Message, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { PromptExtensionType } from '../../enums/PromptExtensionType.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiRetryRenderTask extends ComfyUiBaseTask implements IRetryRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;
    #taskQueue: ITaskQueue;

    #interaction: Message | ButtonInteraction;
    #promptExtension: string | null;
    #promptExtensionType: PromptExtensionType | null;
    #userOverride: User | null;

    #logger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        promptExtension: string | null = null,
        promptExtensionType: PromptExtensionType | null = null,
        userOverride: User | null = null) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#replyService = services.replyService;
        this.#ollamaClient = services.ollamaClient;
        this.#taskQueue = services.taskQueue;

        this.#interaction = interaction;
        this.#promptExtension = promptExtension;
        this.#promptExtensionType = promptExtensionType;
        this.#userOverride = userOverride;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiRetryRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger(LogLevel.Info, 'Processing a ComfyUiRetryRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length === 0) {
            this.#logger(LogLevel.Warning, 'No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let content: string;

        const username =
            this.#userOverride !== null
                ? this.#replyService.mention(this.#userOverride)
                : this.#interaction.member !== null
                    ? this.#replyService.mention(this.#interaction.member.user as User)
                    : 'You';

        for (const imageAttachment of imageAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
            content = `${username} re-rendered \`${renderRequest.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            if (this.#promptExtension !== null) {
                switch (this.#promptExtensionType) {
                    case PromptExtensionType.Emoji:
                        if (this.#featureService.hasFeature(SupportedFeature.ImagesAndText)) {
                            this.#logger(LogLevel.Info,
                                `This bot supports both image and text features, so the provided emoji reaction will be converted to a string.`);

                            const exchange = await this.#ollamaClient.sendMessage(`Tell me the name of the following emoji in as few words as possible: ${this.#promptExtension}.`, []);

                            this.#logger(LogLevel.Info, `The LLM responded with ${exchange.response.response} as the converted text.`);
                            this.#promptExtension = exchange.response.response;
                        }
                        break;
                }

                renderRequest.prompt += `, ${this.#promptExtension.trim()}`;
                content += ` as \`${renderRequest.prompt}\``;
            }

            const workflows = this.#workflowService.workflows.filter(x =>
                x.type === WorkflowType.Txt2img
                || x.type === WorkflowType.Txt2vid);

            const workflow = getRandomArrayEntry(workflows);
            const renderDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

            renderRequest.refreshSeed();
            renderRequest.model = workflow.name;
            renderRequest.num = 1;
            renderRequest.cfgScale = renderDefaults.cfgScale;
            renderRequest.sampler = renderDefaults.sampler;
            renderRequest.scheduler = renderDefaults.scheduler;
            renderRequest.steps = renderDefaults.steps;

            if(renderRequest.model !== workflow.name) {
                renderRequest.height = renderDefaults.height;
                renderRequest.width = renderDefaults.width;
            }

            renderRequests.push(renderRequest);
            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        const replyTask = new ComfyUiReplyTask(this.#services, this.#interaction, { content }, {
            request: renderRequests,
            response: imagesResponse
        });

        this.#taskQueue.add(replyTask);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
