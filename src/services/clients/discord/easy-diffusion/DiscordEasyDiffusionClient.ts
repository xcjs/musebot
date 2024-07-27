import { Buffer } from 'node:buffer';

import {
    ActionRowBuilder,
    AttachmentBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Events,
    Message
} from 'discord.js';
import {Logger, LogLevel } from 'meklog';

import { EasyDiffusionClient } from '../../easy-diffusion/EasyDiffusionClient.js';
import { EnvironmentSettings } from '../../../EnvironmentSettings.js';
import { BufferEncoding } from '../../../../enums/BufferEncoding.js';
import { DiscordPresenceStatus } from '../enums/DiscordPresenceStatus.js';
import { IHttpExchangeWithAttachedResponse } from '../../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../../easy-diffusion/models/responses/IStreamResponse.js';
import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { StableDiffusionGuidanceScaleLimit } from '../../easy-diffusion/enums/StableDiffusionGuidanceScaleLimit.js';
import { BaseDiscordClient } from '../BaseDiscordClient.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';
import { MAX_TEXT_LINE_LENGTH } from '../../../../enums/FileConstants.js';
import { wrapText } from '../../../../utilities/string-utilities.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { TaskQueue } from '../../../tasks/services/TaskQueue.js';
import { PromptRenderTask } from '../../easy-diffusion/tasks/PromptRenderTask.js';
import { EasyDiffusionReplyService } from './EasyDiffusionReplyService.js';
import { FeatureService } from '../../../features/FeatureService.js';
import { RetryRenderTask } from '../../easy-diffusion/tasks/RetryRenderTask.js';
import { ShowSourceTask } from '../../easy-diffusion/tasks/ShowSourceTask.js';

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    #easyDiffusionClient: EasyDiffusionClient;
    #easyDiffusionReplyService: EasyDiffusionReplyService;

    #guidanceScaleInterval = .5;

    constructor(
        environmentSettings: EnvironmentSettings,
        taskQueue: TaskQueue,
        featureService: FeatureService) {
        super(environmentSettings, taskQueue);

        this.environmentSettings = environmentSettings;
        this.#easyDiffusionClient = new EasyDiffusionClient(environmentSettings);
        this.#easyDiffusionReplyService = new EasyDiffusionReplyService(environmentSettings, this.#easyDiffusionClient, featureService);

        this.logger = new Logger(this.environmentSettings.isProduction, 'DiscordEasyDiffusionClient');

        this.#registerEvents();
    }

    login() {
        this.logger(LogLevel.Info, 'Performing client login...');
        this.client.login(this.environmentSettings.discordToken);
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.client.once(Events.ClientReady, (event) => this.#onClientReady.call(self, event));
        this.client.on(Events.MessageCreate, async (message) => await this.#onMessageCreate.call(self, message));
        this.client.on(Events.InteractionCreate, async (interaction) => await this.#onInteraction.call(self, interaction));
    }

    #onClientReady(): Promise<void> {
        if(this.client.user === null) {
            return;
        }

        this.logger(LogLevel.Info, 'Client is ready.');
        this.client.user.setPresence({ activities: [], status: DiscordPresenceStatus.Online });
    }

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger(LogLevel.Info, `Discord message created. ${message.author.displayName} (${message.author.username}): "${message}"`);

        if(!this.replyService.shouldReply(message)) {
            this.logger(LogLevel.Info, 'Reply should not be created - skipping reply.');
            return;
        }

        this.logger(LogLevel.Info, 'Replying to message...');

        await this.typingService.startTyping(message);

        await this.taskQueue.add(new PromptRenderTask(
            this.environmentSettings,
            this.client,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            message));
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        await interaction.deferReply();
        await this.typingService.startTyping(interaction);

        switch(interaction.customId) {
            case BotInteraction.Retry:
                await this.#retry(interaction);
                break;
            case BotInteraction.ShowSource:
                await this.#showSource(interaction);
                break;
            case BotInteraction.GuidanceScaleMinus:
                // if(!renderRequest) {
                //     return;
                // }

                // renderRequest.guidance_scale = renderRequest.guidance_scale - this.#guidanceScaleInterval < StableDiffusionGuidanceScaleLimit.Min
                //     ? renderRequest.guidance_scale
                //     : renderRequest.guidance_scale - this.#guidanceScaleInterval

                // await this.#retry(interaction, renderRequest);
                break;
            case BotInteraction.GuidanceScalePlus:
                // if(!renderRequest) {
                //     return;
                // }

                // renderRequest.guidance_scale = renderRequest.guidance_scale + this.#guidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Max
                //     ? renderRequest.guidance_scale
                //     : renderRequest.guidance_scale + this.#guidanceScaleInterval;

                // await this.#retry(interaction, renderRequest);
                break;
            case BotInteraction.Randomize:
                {
                    // const ollamaClient = new OllamaClient(this.environmentSettings);
                    // const prompt = this.environmentSettings.easyDiffusionOllamaPrompts[getRandomInt(0, this.environmentSettings.easyDiffusionOllamaPrompts.length - 1)];
                    // const exchange = await ollamaClient.sendMessage(prompt, null);

                    // const renderData = await this.#renderImage(interaction, exchange.response.response);
                    // await this.#reply(interaction, renderData);
                }
                break;
            default:
                this.logger(LogLevel.Warning, `An unknown interaction was passed: ${interaction.customId}.`);
                break;
        }
    }

    async #retry(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new RetryRenderTask(
            this.environmentSettings,
            this.#easyDiffusionClient,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #showSource(interaction: ButtonInteraction): Promise<void> {
        await this.taskQueue.add(new ShowSourceTask(
            this.environmentSettings,
            this.#easyDiffusionReplyService,
            interaction));
    }

    async #reply(interaction: Message | ButtonInteraction, renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null) {
        if(renderData?.exchange?.response === null
            && renderData?.response === null
        ) {
            await this.#replyWithError(interaction);
        }

        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        // const fileName = this.#getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);

        const files: Array<AttachmentBuilder> = [];
        const areDescriptionInteractionsAvailable = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            // name: `${fileName}.${renderRequest.output_format}`,
            description: areDescriptionInteractionsAvailable ? jsonRequest : null
        });

        files.push(imageAttachment);

        this.logger(LogLevel.Info, `Attaching render for "${renderRequest.prompt}": ${jsonRequest}`);

        const retryButton = new ButtonBuilder()
            .setCustomId(BotInteraction.Retry)
            .setLabel('🔄')
            .setStyle(ButtonStyle.Secondary);

        const showSourceButton = new ButtonBuilder()
            .setCustomId(BotInteraction.ShowSource)
            .setLabel('{ }')
            .setStyle(ButtonStyle.Secondary);

        const guidanceScaleMinus = new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScaleMinus)
            .setLabel('➖')
            .setStyle(ButtonStyle.Secondary);

        const guidanceScalePlusButton = new ButtonBuilder()
            .setCustomId(BotInteraction.GuidanceScalePlus)
            .setLabel('➕')
            .setStyle(ButtonStyle.Secondary);

        const randomizeButton = new ButtonBuilder()
            .setCustomId(BotInteraction.Randomize)
            .setLabel('🎲')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(retryButton, showSourceButton);

        const nonDescriptionButtonRow = new ActionRowBuilder<ButtonBuilder>();

        if(renderRequest.guidance_scale - this.#guidanceScaleInterval > StableDiffusionGuidanceScaleLimit.Min) {
            buttonRow.addComponents(guidanceScaleMinus);
        }

        if(renderRequest.guidance_scale + this.#guidanceScaleInterval < StableDiffusionGuidanceScaleLimit.Max) {
            buttonRow.addComponents(guidanceScalePlusButton);
        }

        if(this.featureService.hasFeature(SupportedFeature.RandomImageGeneration)) {
            buttonRow.addComponents(randomizeButton);
            nonDescriptionButtonRow.addComponents(randomizeButton);
        }

        const reply: BaseMessageOptions = {
            files,
            components: areDescriptionInteractionsAvailable ? [buttonRow] : [nonDescriptionButtonRow]
        };

        try {
            if(interaction instanceof Message) {
                await interaction.reply(reply);
            } else if(interaction instanceof ButtonInteraction) {
                if(interaction.customId !== BotInteraction.Randomize) {
                    reply.content = `${interaction.member} re-rendered \`${renderRequest.prompt}\`.`.substring(0, DiscordConstants.ContentMaxLength);
                }

                switch(interaction.customId) {
                    case BotInteraction.GuidanceScaleMinus:
                        reply.content = `${reply.content}\n`
                            + `The guidance scale was decreased from ${renderRequest.guidance_scale + this.#guidanceScaleInterval} to ${renderRequest.guidance_scale}.`;
                        break;
                    case BotInteraction.GuidanceScalePlus:
                        reply.content = `${reply.content}\n`
                            + `The guidance scale was increased from ${renderRequest.guidance_scale - this.#guidanceScaleInterval} to ${renderRequest.guidance_scale}.`;
                        break;
                    case BotInteraction.Randomize:
                        {
                            reply.content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol. They present ${interaction.member} with this.`;

                            const promptBuffer = Buffer.from(wrapText(renderRequest.prompt, MAX_TEXT_LINE_LENGTH),
                                BufferEncoding.UTF8);
                            reply.files.push(new AttachmentBuilder(promptBuffer, {
                                // name: `${renderRequest.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.txt`
                            }));
                        }
                        break;
                }

                await (interaction as ButtonInteraction).editReply(reply);
            } else {
                throw new Error(`An invalid interaction was provided: ${typeof interaction}`);
            }
        } catch (error) {
            this.logger(LogLevel.Error, `An exception occurred while replying to a message: ${error}`);
            await this.#replyWithError(interaction);
        }
    }

    async #replyWithError(message: Message | ButtonInteraction): Promise<void> {
        await message.reply({ content: this.environmentSettings.errorMessage });
    }
}
