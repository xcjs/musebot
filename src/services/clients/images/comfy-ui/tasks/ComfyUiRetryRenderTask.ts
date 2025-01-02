import { ButtonInteraction, Message, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { ContentType } from '../../../../../enums/ContentType.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { PromptExtensionType } from '../../enums/PromptExtensionType.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { WorkflowType } from '../enums/WorkflowType.js';
import { IWorkflowService } from '../services/IWorkflowService.js';

export class ComfyUiRetryRenderTask extends BaseTask implements IRetryRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;

    #interaction: Message | ButtonInteraction;
    #promptExtension: string | null;
    #promptExtensionType: PromptExtensionType | null;
    #userOverride: User | null;

    #logger;

    override get taskChannel(): string {
        return `ComfyUi_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        promptExtension: string | null = null,
        promptExtensionType: PromptExtensionType | null = null,
        userOverride: User | null = null) {
        super(services);

        this.#environmentSettings = services.environmentSettings;

        this.#featureService = services.featureService;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#ollamaClient = services.ollamaClient;

        this.#interaction = interaction;
        this.#promptExtension = promptExtension;
        this.#promptExtensionType = promptExtensionType;
        this.#userOverride = userOverride;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ComfyUiRetryRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a ComfyUiRetryRenderTask...');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        if (imageAttachment.description !== null && imageAttachment.description.length === 0) {
            this.#logger(LogLevel.Warning, 'No attachments with descriptions were found - exiting the task.');
            return;
        }

        await this.#workflowService.loadWorkflows();

        let renderRequest: SerializableRenderRequest = null;
        let content: string;

        renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
        content =
            `${this.#userOverride !== null ? this.#replyService.mention(this.#userOverride) : this.#interaction.member}`
            + ` re-rendered \`${renderRequest.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

        if(this.#promptExtension !== null) {
            switch(this.#promptExtensionType) {
                case PromptExtensionType.Emoji:
                    if(this.#featureService.hasFeature(SupportedFeature.ImagesAndText)) {
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
        } else {
            renderRequest.refreshSeed();
        }

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === WorkflowType.Txt2img
            || x.type === WorkflowType.Txt2vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger(LogLevel.Info, `Using ${workflow.name} as the selected workflow.`);

        // Normalize render request to use settings best for the newly selected
        // workflow.

        const defaultRequest = this.#workflowService.getWorkflowDefaults(workflow);
        defaultRequest.prompt = renderRequest.prompt;
        defaultRequest.seed = renderRequest.seed;
        renderRequest = defaultRequest;

        const workflowPrompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const images = await this.#comfyUiClient.render(workflowPrompt);

        await this.#comfyUiReplyService.reply(this.#interaction, {
            request: renderRequest,
            response: images
        }, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
