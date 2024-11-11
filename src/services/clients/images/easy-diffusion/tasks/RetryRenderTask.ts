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
import { EasyDiffusionReplyService } from '../../../chat/discord/easy-diffusion/EasyDiffusionReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { PromptExtensionType } from '../../enums/PromptExtensionType.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { EasyDiffusionClient } from '../EasyDiffusionClient.js';
import { RenderRequest } from '../models/requests/RenderRequest.js';

export class RetryRenderTask extends BaseTask implements IRetryRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;

    #interaction: Message | ButtonInteraction;
    #promptExtension: string | null;
    #promptExtensionType: PromptExtensionType | null;
    #userOverride: User | null;

    #logger;

    override get taskChannel(): string {
        return `EasyDiffusion_${this.#easyDiffusionClient.host}`;
    }

    constructor(
        services: IServiceContainer,
        interaction: Message | ButtonInteraction,
        promptExtension: string | null = null,
        promptExtensionType: PromptExtensionType = null,
        userOverride: User | null = null) {
        super(services);

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#easyDiffusionClient = services.easyDiffusionClient;
        this.#easyDiffusionReplyService = services.easyDiffusionReplyService;
        this.#replyService = services.replyService;

        this.#interaction = interaction;
        this.#promptExtension = promptExtension;
        this.#promptExtensionType = promptExtensionType;
        this.#userOverride = userOverride;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'RetryRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RetryRenderTask.');

        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ];

        const imageAttachment = this.#replyService.getAttachmentsByType(this.#interaction, imageTypes)[0];

        let request: RenderRequest = null;
        let content: string;

        if(imageAttachment?.description) {
            request = RenderRequest.fromJson(imageAttachment.description);
            content =
                `${this.#userOverride.id ? this.#replyService.mention(this.#userOverride) : this.#interaction.member}`
                + ` re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

            if(this.#promptExtension !== null) {
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

                request.prompt += ` ${this.#promptExtension}`;
                content += ` as \`${request.prompt}\``;
            } else {
                request.refreshSeed();
            }
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#easyDiffusionClient.getModels());

        this.#logger(LogLevel.Info, `Using ${model} as the selected EasyDiffusion model.`);
        request.use_stable_diffusion_model = model;

        const renderData = await this.#easyDiffusionReplyService.renderImage(request);

        // const content = `${this.#interaction.member} re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

        await this.#easyDiffusionReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
