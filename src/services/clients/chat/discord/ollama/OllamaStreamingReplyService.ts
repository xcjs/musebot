import { ActionRowBuilder, ButtonBuilder, Message } from 'discord.js';

import { splitText } from '../../../../../utilities/string-utilities.js';
import { ILogger } from '../../../../ILogger.js';
import { IBotServiceContainer } from "../../../../IServiceContainer.js"
import { ChatActionRow } from '../components/buttonRows/ChatActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class OllamaStreamingReplyService {
    #services: IBotServiceContainer;

    #logger: ILogger;

    #replies: Array<Message> = [];
    #repliesContent: string[] = [];

    constructor(services: IBotServiceContainer) {
        this.#services = services;

        this.#logger = services.getLogger('OllamaStreamingReplyService');
    }

    async reply(
        message: Message,
        responseBatch: string,
        done: boolean): Promise<Message[]> {
        const components = done ? new ChatActionRow(this.#services).build() : [];

        const currentReply = this.#currentReply();

        if (currentReply === null
            && responseBatch.length <= DiscordConstants.ContentMaxLength) {

            this.#repliesContent.push(responseBatch);
            const currentReplyContent = this.#repliesContent[this.#repliesContent.length - 1];

            this.#logger.info(`Replying  "${responseBatch}"`);

            this.#replies.push(await message.reply({
                content: currentReplyContent,
                components
            }));

            await this.#rebalanceReplies(message, components);
        } else if (currentReply !== null
            && currentReply.content.length + responseBatch.length <= DiscordConstants.ContentMaxLength) {

            const numReplies = this.#replies.length;
            const currentMessage = numReplies - 1;

            this.#repliesContent[currentMessage] += responseBatch;
            const currentReplyContent = this.#repliesContent[currentMessage];

            this.#logger.info(`Appending "${responseBatch}"`);

            await currentReply.edit({
                content: currentReplyContent,
                components
            });
        }
        else {
            const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

            if (responseBatches.length > 0) {
                const response = responseBatches[0];

                this.#repliesContent.push(response);
                this.#logger.info(`Replying "${response}"`);

                this.#replies.push(await message.reply({
                    content: response,
                    components
                }));

                await this.#rebalanceReplies(message, components);
            }

            let firstResponse = true;

            for (const response of responseBatches) {
                if (firstResponse) {
                    firstResponse = false;
                    continue;
                }

                this.#logger.info(`Recursing "${response}"`);
                await this.reply(message, response, done);
            }
        }

        return this.#replies;
    }

    clearState(): void {
        this.#replies = [];
    }

    #currentReply(): Message | null {
        if (this.#replies.length === 0) {
            return null;
        }

        return this.#replies[this.#replies.length - 1];
    }

    async #rebalanceReplies(message: Message, components: ActionRowBuilder<ButtonBuilder>[] = []): Promise<void> {
        this.#repliesContent = splitText(this.#repliesContent.join(''), DiscordConstants.ContentMaxLength);

        let i = 0;

        for (const replyContent of this.#repliesContent) {
            const isLastReply = i + 1 === this.#repliesContent.length;

            if (this.#replies[i] !== undefined) {
                await this.#replies[i].edit({
                    content: replyContent,
                    components: isLastReply ? components : []
                });
            } else {
                this.#replies.push(await message.reply({
                    content: replyContent,
                    components: isLastReply ? components : []
                }));
            }

            i++;
        }
    }
}
