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

import { EasyDiffusionClient } from '../easy-diffusion/EasyDiffusionClient.js';
import { ContentType } from '../../../enums/ContentType.js';
import { EnvironmentSettings } from '../../EnvironmentSettings.js';
import { BufferEncoding } from '../../../enums/BufferEncoding.js';
import { DiscordPresenceStatus } from './enums/DiscordPresenceStatus.js';
import { IHttpExchangeWithAttachedResponse } from '../../../models/IHttpExchangeWithAttachedResponse.js';
import { RenderRequest } from '../easy-diffusion/models/requests/RenderRequest.js';
import { IRenderResponse } from '../easy-diffusion/models/responses/IRenderResponse.js';
import { IStreamResponse } from '../easy-diffusion/models/responses/IStreamResponse.js';
import { BotInteraction } from '../../../enums/BotInteraction.js';
import { StableDiffusionGuidanceScaleLimit } from '../easy-diffusion/enums/StableDiffusionGuidanceScaleLimit.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { DiscordConstants } from './enums/DiscordConstants.js';
import { MAX_FILE_NAME_LENGTH, MAX_TEXT_LINE_LENGTH } from '../../../enums/FileConstants.js';
import { wrapText } from '../../../utilities/string-utilities.js';
import { SupportedFeature } from '../../features/enum/SupportedFeature.js';
import { TaskQueue } from '../../tasks/services/TaskQueue.js';
import { PromptRenderTask } from '../easy-diffusion/tasks/PromptRenderTask.js';

export class DiscordEasyDiffusionClient extends BaseDiscordClient {
    easyDiffusionClients: Array<EasyDiffusionClient> = [];
    ollamaClients: Array<OllamaClient> = [];

    #guidanceScaleInterval = .5;

    constructor(environmentSettings: EnvironmentSettings, taskQueue: TaskQueue) {
        super(environmentSettings, taskQueue);

        this.environmentSettings = environmentSettings;

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

        this.taskQueue.add(new PromptRenderTask(
            this.environmentSettings,
            this.featureService,
            this.client,
            new EasyDiffusionClient(this.environmentSettings),
            message));

        this.typingService.startTyping(message);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger(LogLevel.Info, `Beginning interaction response to custom action ${interaction.customId}...`);

        const supportedContentTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png
        ]

        const attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value }));

        const imageAttachment = attachments.filter(attachment =>
            supportedContentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue === attachment.value.contentType)))[0].value;

        let renderRequest: RenderRequest = null;

        if(imageAttachment?.description) {
            renderRequest = RenderRequest.FromJson(imageAttachment.description);
        }

        await interaction.deferReply();

        switch(interaction.customId) {
            case BotInteraction.Retry:
                // if(!renderRequest) {
                //     return;
                // }

                // this.#retry(interaction, renderRequest.prompt);
                break;
            case BotInteraction.ShowSource:
                if(!renderRequest) {
                    return;
                }

                this.#showSource(interaction, renderRequest, imageAttachment.description);
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

    async #onRetry(interaction: ButtonInteraction, renderRequest: RenderRequest) {
        if(!renderRequest) {
            return;
        }

        // this.#retry(interaction, renderRequest.prompt);
    }

    async #reply(interaction: Message | ButtonInteraction, renderData: IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null) {
        if(renderData?.exchange?.response === null
            && renderData?.response === null
        ) {
            await this.#replyWithError(interaction);
        }

        const renderRequest = renderData.exchange.request;
        const streamResponse = renderData.response;

        const fileName = this.#getFileNameFromPrompt(renderRequest);
        const jsonRequest = JSON.stringify(renderRequest);

        const files: Array<AttachmentBuilder> = [];
        const areDescriptionInteractionsAvailable = jsonRequest.length <= DiscordConstants.ImageDescriptionMaxLength;

        const imageBuffer = Buffer.from(streamResponse.output[0].data.split(",")[1], BufferEncoding.Base64);

        const imageAttachment = new AttachmentBuilder(imageBuffer, {
            name: `${fileName}.${renderRequest.output_format}`,
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
                                name: `${renderRequest.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.txt`
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

    // async #retry(interaction: ButtonInteraction, prompt: string | RenderRequest): Promise<void> {
    //     const renderData = await this.#renderImage(interaction, prompt);
    //     await this.#reply(interaction, renderData);
    // }

    async #showSource(interaction, renderRequest, jsonRequest): Promise<void> {
        const jsonBuffer = Buffer.from(jsonRequest, BufferEncoding.UTF8);
        const jsonAttachment = new AttachmentBuilder(jsonBuffer, {
            name: `${this.#getFileNameFromPrompt(renderRequest)}.json`
        });

        const reply = {
            content: `${interaction.member} wanted to see the request message for \`${renderRequest.prompt}\`.`,
            files: [jsonAttachment]
        };

        await interaction.editReply(reply);
    }

    #getFileNameFromPrompt(renderRequest: RenderRequest): string {
        return `${renderRequest.seed}_${renderRequest.prompt}`.substring(0, MAX_FILE_NAME_LENGTH);
    }

    // async #renderImage(interaction: Message | ButtonInteraction, prompt: string | RenderRequest |  null)
    //     : Promise<IHttpExchangeWithAttachedResponse<RenderRequest, IRenderResponse, IStreamResponse> | null> {
    //     let botMention: string = '';
    //     prompt = prompt || '';

    //     if(interaction instanceof Message && !(prompt instanceof RenderRequest)) {
    //         botMention = interaction.mentions.members.find(x => x.id === this.client.user?.id)?.toString() || '';
    //         prompt = interaction.content;
    //     }

    //     prompt = prompt instanceof RenderRequest
    //         ? prompt
    //         : prompt.replaceAll(botMention, '').trim();

    //     if(typeof prompt === JavaScriptType.String && (prompt as string).substring(0, 1) === '{') {
    //         try {
    //             prompt = RenderRequest.FromJson(prompt as string);
    //             prompt.num_outputs = 1;
    //         } catch(error) {
    //             this.logger(LogLevel.Info, `A possible JSON prompt was received, but could not be deserialized to ${typeof RenderRequest}.`);
    //         }
    //     }

    //     const easyDiffusionClient = new EasyDiffusionClient(this.environmentSettings);
    //     this.easyDiffusionClients.push(easyDiffusionClient);

    //     this.logger(LogLevel.Info, `Render prompt: ${prompt}`);

    //     const renderExchange = await easyDiffusionClient.render(prompt);

    //     if(renderExchange === null || renderExchange.response === null) {
    //         return null;
    //     }

    //     const streamResponse = await easyDiffusionClient.stream(renderExchange);

    //     return {
    //         exchange: renderExchange,
    //         response: streamResponse
    //     };
    // }

    async #replyWithError(message: Message | ButtonInteraction): Promise<void> {
        await message.reply({ content: this.environmentSettings.errorMessage });
    }
}
