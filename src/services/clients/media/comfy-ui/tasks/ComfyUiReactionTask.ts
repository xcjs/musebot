import { Prompt } from 'comfy-ui-client';
import { BaseMessageOptions, Message, MessageReaction, User } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../llm/ollama/OllamaClient.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiReactionTask extends ComfyUiBaseTask {
    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;
    #logger: ILogger;

    #reaction: MessageReaction;
    #userOverride: User | null;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        reaction: MessageReaction,
        userOverride: User | null = null) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#ollamaClient = services.ollamaClient;
        this.#logger = services.getLogger('ComfyUiReactionTask');

        this.#reaction = reaction;
        this.#userOverride = userOverride;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiReactionTask...');

        const imageAttachments = this.#replyService.getImageAttachments(this.#reaction.message as Message);

        if (imageAttachments.length === 0) {
            this.#logger.warn('No attachments were found - exiting the task.');
            return;
        }

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        const username =
            this.#userOverride !== null
                ? this.#replyService.mention(this.#userOverride)
                : this.#reaction.users.cache.hasAny()
                    ? this.#reaction.users.cache.first().toString()
                    : 'You';


        let content = '';
        let emojiText = this.#reaction.emoji.name;

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            this.#logger.info(`Text generation is supported - converting the emoji to plain text for better model compatibility.`);
            const exchange = await this.#ollamaClient.sendMessage(`Tell me the name of the following emoji in as few words as possible: ${this.#reaction.emoji.name}.`, []);
            emojiText = exchange.exchange.response.message.content.trim();
            this.#logger.info(`The LLM responded with ${emojiText} as the converted text.`);
        }

        for (const imageAttachment of imageAttachments) {
            if(imageAttachment.description === null || imageAttachment.description.length === 0) {
                continue;
            }

            const renderRequest = SerializableRenderRequest.fromJson(imageAttachment.description);
            const newPrompt = `${renderRequest.prompt}, ${emojiText}`;

            content = `${username} retried \`${renderRequest.prompt}\` as \`${newPrompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            const workflows = this.#workflowService.workflows.filter(x =>
                x.type.startsWith('txt2')
                && x.type !== SupportedFeature.Txt2Txt
                && x.type !== SupportedFeature.Txt2Music);

            const workflow = getRandomArrayEntry(workflows);
            const renderDefaults = this.#workflowService.getWorkflowDefaults(workflow);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            renderRequest.prompt = newPrompt;
            renderRequest.refreshSeed();
            renderRequest.workflow = workflow.name;
            renderRequest.num = 1;
            renderRequest.cfgScale = renderDefaults.cfgScale;
            renderRequest.sampler = renderDefaults.sampler;
            renderRequest.scheduler = renderDefaults.scheduler;
            renderRequest.steps = renderDefaults.steps;

            if(renderRequest.workflow !== workflow.name) {
                renderRequest.height = renderDefaults.height;
                renderRequest.width = renderDefaults.width;
            }

            renderRequests.push(renderRequest);
            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
        }

        if(prompts.length === 0) {
            // No prompts were provided, so we can return early.
            return;
        }

        const imagesResponse = await this.#comfyUiClient.render(prompts);

        const reply: BaseMessageOptions = { content };
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: imagesResponse
        };

        await this.#comfyUiReplyService.reply(this.#reaction.message as Message, reply, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#reaction.message as Message);
        }
    }
}
