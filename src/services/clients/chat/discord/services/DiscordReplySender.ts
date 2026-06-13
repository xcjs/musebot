import { BaseMessageOptions, ButtonInteraction, Message } from 'discord.js';

import { splitText } from '../../../../../utilities/string-utilities.js';
import { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class DiscordReplySender {
    readonly #configurationService: IConfigurationService;
    readonly #logger: ILogger;

    constructor(services: IBotServiceContainer) {
        this.#configurationService = services.configurationService;
        this.#logger = services.getLogger('DiscordReplySender');
    }

    async reply(
        interaction: Message | ButtonInteraction,
        reply: BaseMessageOptions,
        isEdit: boolean = false
    ): Promise<void> {
        const replyContents = splitText(reply.content?.trim() || '', DiscordConstants.ContentMaxLength);

        if(replyContents.length === 0) {
            replyContents.push('');
        }

        let i = 0;

        for (const contentFragment of replyContents) {
            const replyAttachments = i + 1 === replyContents.length ? reply.files : [];

            if (interaction instanceof Message && !isEdit) {
                await interaction.reply({
                    content: contentFragment.trim(),
                    files: replyAttachments,
                    components: reply.components
                });
            } else if(interaction instanceof Message && isEdit) {
                await interaction.edit({
                    content: interaction.content,
                    files: reply.files,
                    components: interaction.components
                });
            } else if (interaction instanceof ButtonInteraction && i >= 0) {
                const replyFragment: BaseMessageOptions = {
                    content: contentFragment.trim(),
                    files: replyAttachments,
                    components: reply.components
                };

                await interaction.message.reply(replyFragment);

            } else {
                this.#logger.warn(
                    `An interaction occurred that did not fit the reply criteria of either being an edited reply to a`
                    + ` ${typeof ButtonInteraction} nor a direct reply to any type of interaction.`);
            }

            i++;
        }
    }

    async replyWithError(interaction: Message | ButtonInteraction): Promise<void> {
        await interaction.reply({ content: this.#configurationService.errorMessage });
    }
}
