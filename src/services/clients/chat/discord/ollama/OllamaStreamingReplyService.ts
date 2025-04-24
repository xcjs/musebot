import { Message } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { splitText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { LargeLanguageModelActionRow } from '../components/buttonRows/LargeLanguageModelActionRow.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class OllamaStreamingReplyService {
    #services: IServiceContainer;
    #environmentSettings: IEnvironmentSettings;

    #logger;

    #replies: Array<Message> = [];
    #repliesContent: string[] = [];

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'OllamaStreamingReplyService');
    }

    async reply(
        message: Message,
        responseBatch: string,
        done: boolean): Promise<Message[]> {
        const components = done ? new LargeLanguageModelActionRow(this.#services).build() : null;

        if (this.#currentReply() == null && responseBatch.length <= DiscordConstants.ContentMaxLength) {

            this.#repliesContent.push(responseBatch);
            const currentReplyContent = this.#repliesContent[this.#repliesContent.length - 1];

            this.#logger(LogLevel.Info, `Replying  "${currentReplyContent}"`);

            this.#replies.push(await message.reply({
                content: currentReplyContent,
                components
            }));

        } else if (this.#currentReply().content.length + responseBatch.length <= DiscordConstants.ContentMaxLength) {

            const numReplies = this.#replies.length;
            const currentMessage = numReplies - 1;

            this.#repliesContent[currentMessage] += responseBatch;
            const currentReplyContent = this.#repliesContent[currentMessage];

            this.#logger(LogLevel.Info, `Appending "${responseBatch}"`);

            await this.#currentReply().edit({
                content: currentReplyContent,
                components
            });
        }
        else {
            const responseBatches = splitText(responseBatch, DiscordConstants.ContentMaxLength);

            if(responseBatches.length > 0) {
                const response = responseBatches[0];

                this.#repliesContent.push(response);
                const currentReplyContent = this.#repliesContent[this.#repliesContent.length - 1];
                this.#logger(LogLevel.Info, `Replying  "${currentReplyContent}"`);

                this.#replies.push(await message.reply({
                    content: currentReplyContent,
                    components
                }));
            }

            for(const response of responseBatches) {
                if(response === responseBatches[0]) {
                    continue;
                }

                await this.reply(message, response, done);
            }
        }

        return this.#replies;
    }

    clearState(): void {
        this.#replies = [];
    }

    #currentReply(): Message | null {
        if(this.#replies.length === 0) {
            return null;
        }

        return this.#replies[this.#replies.length - 1];
    }
}
