import { ButtonInteraction, Message, User } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IEnvironmentSettings } from '../../../../IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { BaseTask } from '../../../../tasks/models/BaseTask.js';
import { Automatic1111ReplyService } from '../../../chat/discord/automatic1111/Automatic1111ReplyService.js';
import { DiscordConstants } from '../../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../text/ollama/OllamaClient.js';
import { PromptExtensionType } from '../../enums/PromptExtensionType.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IRetryRenderTask } from '../../tasks/IRetryRenderTask.js';
import { Automatic1111Client } from '../Automatic1111Client.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';

export class RetryRenderTask extends BaseTask implements IRetryRenderTask {
    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #automatic1111Client: Automatic1111Client;
    #automatic1111ReplyService: Automatic1111ReplyService;
    #replyService: IReplyService;
    #ollamaClient: OllamaClient;

    #interaction: Message | ButtonInteraction;
    #promptExtension: string | null;
    #promptExtensionType: PromptExtensionType | null;
    #userOverride: User | null;

    #logger;

    override get taskChannel(): string {
        return `Automatic1111_${this.#automatic1111Client.host}`;
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
        this.#automatic1111Client = services.automatic1111Client;
        this.#automatic1111ReplyService = services.automatic1111ReplyService;
        this.#replyService = services.replyService;
        this.#ollamaClient = services.ollamaClient;

        this.#interaction = interaction;
        this.#promptExtension = promptExtension;
        this.#promptExtensionType = promptExtensionType;
        this.#userOverride = userOverride;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'RetryRenderTask');
    }

    override async process(): Promise<void> {
        this.#logger(LogLevel.Info, 'Processing a RetryRenderTask.');

        const imageAttachment = this.#replyService.getImageAttachments(this.#interaction)[0];

        let request: Txt2ImgOptionsRequest = null;
        let content: string;

        if(imageAttachment?.description) {
            request = SerializableRenderRequest.fromJson(imageAttachment.description).toTxt2ImgOptionsRequest();
            content =
                `${this.#userOverride !== null ? this.#replyService.mention(this.#userOverride) : this.#interaction.member}`
                + ` re-rendered \`${request.prompt}\``.substring(0, DiscordConstants.ContentMaxLength);

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

                request.prompt += `, ${this.#promptExtension.trim()}`;
                content += ` as \`${request.prompt}\``;
            } else {
                request.seed = -1;
            }
        }

        const model = this.#environmentSettings.stableDiffusionModels.length > 0 ?
            getRandomArrayEntry(this.#environmentSettings.stableDiffusionModels) :
            getRandomArrayEntry(await this.#automatic1111Client.getModels()).title.split(' ')[0];

        this.#logger(LogLevel.Info, `Using ${model} as the selected image generation model.`);

        const renderData = await this.#automatic1111Client.render(request, model);

        await this.#automatic1111ReplyService.reply(this.#interaction, renderData, content);
    }

    override async postProcess(): Promise<void> {
        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
