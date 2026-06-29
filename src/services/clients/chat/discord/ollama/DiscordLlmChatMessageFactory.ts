import { Attachment, BaseGuildTextChannel, ButtonInteraction, Message as DiscordMessage, MessageReaction, ThreadChannel } from 'discord.js';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { LlmChatMessage } from '../../../llm/ollama/models/LlmChatMessage.js';
import { LlmChatMessageAttachment } from '../../../llm/ollama/models/LlmChatMessageAttachment.js';
import { ILlmChatMessageFactory } from '../../../llm/services/ILlmChatMessageFactory.js';
import { WebContentService } from '../../../llm/services/web/WebContentService.js';
import { IReplyService } from '../../IReplyService.js';
import { DiscordAttachmentService } from '../services/DiscordAttachmentService.js';

type DiscordReplyService = IReplyService<DiscordMessage, MessageReaction, Attachment, DiscordMessage | ButtonInteraction>;

export class DiscordLlmChatMessageFactory implements ILlmChatMessageFactory<DiscordMessage> {
    readonly #replyService: DiscordReplyService;
    readonly #featureService: IFeatureService;
    readonly #attachmentService: DiscordAttachmentService;
    readonly #webContentService: WebContentService;

    constructor(services: { getReplyService(): DiscordReplyService; featureService: IFeatureService; webContentService: WebContentService }) {
        this.#replyService = services.getReplyService();
        this.#featureService = services.featureService;
        this.#attachmentService = new DiscordAttachmentService();
        this.#webContentService = services.webContentService;
    }

    create(chatMessage: DiscordMessage): LlmChatMessage {
        const channelName = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.name
            : null;
        const channelTopic = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.topic
            : null;

        const thread = chatMessage.channel instanceof ThreadChannel
            ? {
                id: chatMessage.channel.id,
                name: chatMessage.channel.name,
                parentId: chatMessage.channel.parentId
            }
            : null;

        return {
            messageId: chatMessage.id,
            username: chatMessage.author.username,
            displayName: chatMessage.author.displayName,
            userId: chatMessage.author.id,
            isBot: chatMessage.author.bot,
            message: this.#replyService.getMessageWithoutBotMentions(chatMessage),
            datetime: chatMessage.createdAt.toISOString(),
            roles: chatMessage.member?.roles.cache.map((role) => ({ id: role.id, name: role.name })) ?? [],
            channel: {
                id: chatMessage.channelId,
                name: channelName,
                topic: channelTopic
            },
            thread,
            server: {
                id: chatMessage.guildId,
                name: chatMessage.guild?.name ?? null
            },
            mentions: {
                users: chatMessage.mentions.users.map((user) => ({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    isBot: user.bot
                })),
                roles: chatMessage.mentions.roles.map((role) => ({ id: role.id, name: role.name })),
                everyone: chatMessage.mentions.everyone
            },
            attachments: this.#extractAttachments(chatMessage)
        };
    }

    createFromLlmResponse(content: string, chatMessage: DiscordMessage): LlmChatMessage {
        const channelName = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.name
            : null;
        const channelTopic = chatMessage.channel instanceof BaseGuildTextChannel
            ? chatMessage.channel.topic
            : null;

        const thread = chatMessage.channel instanceof ThreadChannel
            ? {
                id: chatMessage.channel.id,
                name: chatMessage.channel.name,
                parentId: chatMessage.channel.parentId
            }
            : null;

        const clientUser = chatMessage.client.user;

        return {
            messageId: null,
            username: clientUser?.username ?? 'musebot',
            displayName: clientUser?.displayName ?? 'Musebot',
            userId: clientUser?.id ?? '0',
            isBot: true,
            message: content,
            datetime: new Date().toISOString(),
            roles: [],
            channel: {
                id: chatMessage.channelId,
                name: channelName,
                topic: channelTopic
            },
            thread,
            server: {
                id: chatMessage.guildId,
                name: chatMessage.guild?.name ?? null
            },
            mentions: {
                users: [],
                roles: [],
                everyone: false
            },
            attachments: []
        };
    }

    #extractAttachments(chatMessage: DiscordMessage): LlmChatMessageAttachment[] {
        const attachments: LlmChatMessageAttachment[] = [];

        if (this.#featureService.hasFeature(SupportedFeature.Vision)) {
            const imageAttachments = this.#attachmentService.getImageAttachments(chatMessage);

            for (const attachment of imageAttachments) {
                attachments.push({
                    filename: attachment.name,
                    url: attachment.url,
                    type: 'image',
                    interpretation: ''
                });
            }
        }

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            const messageText = this.#replyService.getMessageWithoutBotMentions(chatMessage);
            const urls = this.#webContentService.extractUrls(messageText);

            for (const url of urls) {
                attachments.push({
                    filename: url,
                    url,
                    type: 'web',
                    interpretation: ''
                });
            }
        }

        return attachments;
    }
}