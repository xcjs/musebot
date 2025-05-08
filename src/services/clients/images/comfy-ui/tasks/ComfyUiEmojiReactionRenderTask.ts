import { Prompt } from 'comfy-ui-client';
import { ButtonInteraction, Message, ReactionEmoji, User } from 'discord.js';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ITaskQueue } from '../../../../tasks/ITaskQueue.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IEmojiReactionRenderTask } from '../../tasks/IEmojiReactionRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';
import { ComfyUiReplyTask } from './ComfyUiReplyTask.js';

export class ComfyUiEmojiReactionRenderTask extends ComfyUiBaseTask implements IEmojiReactionRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;
    #taskQueue: ITaskQueue;

    #interaction: Message | ButtonInteraction;
    #emoji: ReactionEmoji;
    #userOverride: User | null;

    #logger: ILogger;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        emoji: ReactionEmoji | null = null,
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
        this.#emoji = emoji;
        this.#userOverride = userOverride;

        this.#logger = services.getLogger('ComfyUiEmojiReactionRenderTask');
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiEmojiReactionRenderTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#interaction);

        if (imageAttachments.length === 0) {
            this.#logger.warning('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        const username =
            this.#userOverride !== null
                ? this.#replyService.mention(this.#userOverride)
                : this.#interaction.member !== null
                    ? this.#replyService.mention(this.#interaction.member.user as User)
                    : 'You';

        let content = '';
        let emojiText = this.#emoji.name;

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            this.#logger.info(`Text generation is supported - converting the emoji to plain text for better model compatibility.`);
            const exchange = await this.#ollamaClient.sendMessage(`Tell me the name of the following emoji in as few words as possible: ${this.#emoji.name}.`, []);
            emojiText = exchange.response.response.trim();
            this.#logger.info(`The LLM responded with ${emojiText} as the converted text.`);
        }

        for (const imageAttachment of imageAttachments) {
            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
            const newPrompt = `${renderRequest.prompt}, ${emojiText}`;

            content = `${username} re-rendered \`${renderRequest.prompt}\` as ${newPrompt}`.substring(0, DiscordConstants.ContentMaxLength);

            const workflows = this.#workflowService.workflows.filter(x =>
                x.type === SupportedFeature.Txt2Img
                || x.type === SupportedFeature.Txt2Vid);

            const workflow = getRandomArrayEntry(workflows);
            const renderDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.prompt = newPrompt;
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
