import { Client as DiscordClient, Message, MessageReaction, MessageType } from 'discord.js';

import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export class DiscordReplyFilter {
    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #featureService: IFeatureService;
    #logger: ILogger;

    constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#featureService = services.featureService;

        this.#logger = services.getLogger('DiscordReplyFilter');
    }

    shouldReply(message: Message, reaction: MessageReaction | null): boolean {
        if(reaction !== null) {
            if (message.author.id !== this.#discordClient.user?.id) {
                this.#logger.info('Not replying to a reaction not on my message.');
                return false;
            }

            if(reaction.me) {
                this.#logger.info('Not replying to a reaction from myself.');
                return false;
            }
        } else {
            if (message.system) {
                this.#logger.info('Not replying to a system message.');
                return false;
            }

            if (!message.guild && !(this.#environmentSettings.botPrivateMessageUsers.includes(message.author.username))) {
                this.#logger.info('Not replying to a non-guild message that\'s not from someone in a private messaging role.');
                return false;
            }

            if (message.type !== MessageType.Default
                && message.type !== MessageType.Reply) {
                this.#logger.info('Not replying to a non-default or non-reaction message.');
                return false;
            }

            if (!message.author.id) {
                this.#logger.info('Not replying to a message without an author.');
                return false;
            }

            if (message.author.id === this.#discordClient.user?.id) {
                this.#logger.info('Not replying to myself.');
                return false;
            }

            if (message.author.bot) {
                this.#logger.info('Not replying to any other bots/apps.');
                return false;
            }

            if (message.guild !== null
                && (this.#environmentSettings.botRequiresMention
                    && !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id))) {
                const botRole = message.guild.members?.resolve(this.#discordClient.user).roles.botRole;

                if (message.mentions.roles.find(x => x.id === botRole?.id) === undefined) {
                    this.#logger.info('Not replying to a message that doesn\'t mention or react to this bot or its role.');
                    return false;
                }
            }

            const generatedResponseRate = getRandomInt(1, 100);

            if ((!this.#environmentSettings.botRequiresMention
                && generatedResponseRate > this.#environmentSettings.botResponseRate)
                && !message.mentions.members?.find(x => x.id === this.#discordClient.user?.id)) {
                this.#logger.info(`Not replying to a message outside the response rate` +
                    ` (${generatedResponseRate} > ${this.#environmentSettings.botResponseRate}).`);
                return false;
            }

            if (message.guild !== null
                && this.#environmentSettings.discordChannels.length > 0
                && !this.#environmentSettings.discordChannels.includes(message.channel.id)) {
                this.#logger.info('Not replying to a message in a channel outside this bot\'s allowed channels.');
                return false;
            }

            if (message.guild !== null
                && this.#environmentSettings.discordChannelsDisallowed.length > 0
                && this.#environmentSettings.discordChannelsDisallowed.includes(message.channel.id)) {
                this.#logger.info('Not replying to a message in a disallowed channel.');
                return false;
            }

            if (message.content.length === 0
                && (this.#getImageAttachments(message).length === 0
                    || (!this.#featureService.hasFeature(SupportedFeature.Img2Img)
                        && !this.#featureService.hasFeature(SupportedFeature.Img2Vid)
                        && !this.#featureService.hasFeature(SupportedFeature.ContextualImg2Img)))
            ) {
                this.#logger.info('Not replying to a message with no content.');
                return false;
            }
        }

        return true;
    }

    #getImageAttachments(message: Message): unknown[] {
        const imageTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        const attachments = Array.from(message.attachments.values());

        return attachments.filter(attachment => imageTypes.includes(attachment.contentType));
    }
}
