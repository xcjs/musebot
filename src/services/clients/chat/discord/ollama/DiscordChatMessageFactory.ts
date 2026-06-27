import { AttachmentBuilder, Message } from 'discord.js';

import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageAttachment } from '../../IChatMessageAttachment.js';
import { IChatMessageFactory } from '../../IChatMessageFactory.js';
import { ChatActionRow } from '../components/buttonRows/ChatActionRow.js';

export class DiscordChatMessageFactory implements IChatMessageFactory<Message> {
    readonly #services: IBotServiceContainer;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
    }

    async createMessages(target: Message, messages: IChatMessage[]): Promise<Message[]> {
        const replies: Message[] = [];

        for (let i = 0; i < messages.length; i++) {
            const isLast = i === messages.length - 1;
            const chatMessage = messages[i];

            replies.push(await target.reply({
                content: chatMessage.content,
                components: isLast ? new ChatActionRow(this.#services).build() : [],
                files: this.#toAttachmentBuilders(chatMessage.attachments)
            }));
        }

        return replies;
    }

    async updateMessages(target: Message, messages: Message[], chatMessages: IChatMessage[]): Promise<Message[]> {
        const updated: Message[] = [];

        for (let i = 0; i < chatMessages.length; i++) {
            const chatMessage = chatMessages[i];
            const isLast = i === chatMessages.length - 1;

            if (messages[i] !== undefined) {
                updated.push(await messages[i].edit({
                    content: chatMessage.content,
                    components: isLast ? new ChatActionRow(this.#services).build() : [],
                    files: this.#toAttachmentBuilders(chatMessage.attachments)
                }));
            } else {
                updated.push(await target.reply({
                    content: chatMessage.content,
                    components: isLast ? new ChatActionRow(this.#services).build() : [],
                    files: this.#toAttachmentBuilders(chatMessage.attachments)
                }));
            }
        }

        return updated;
    }

    #toAttachmentBuilders(attachments: IChatMessageAttachment[]): AttachmentBuilder[] {
        return attachments.map(a => new AttachmentBuilder(a.data, { name: a.name, description: a.description }));
    }
}