import { Attachment, ButtonInteraction, Message } from 'discord.js';

import { ContentType } from '../../../../../enums/ContentType.js';

export class DiscordAttachmentService {
    getAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        return this.getAttachmentsByType(interaction, []);
    }

    getAttachmentsByType(
        interaction: Message | ButtonInteraction,
        contentTypes: ContentType[] | undefined
    ): Attachment[] {
        let attachments: Attachment[] = [];

        if (interaction instanceof Message) {
            attachments = Array.from(interaction.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        } else if (interaction instanceof ButtonInteraction) {
            attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        }

        let matchingAttachments: Attachment[] = attachments;

        if(contentTypes && contentTypes.length > 0) {
            matchingAttachments = attachments.filter(attachment =>
                contentTypes.includes(Object.values(ContentType)
                    .find(contentTypeValue => contentTypeValue.toString() === attachment.contentType)));
        }

        return matchingAttachments;
    }

    getAudioAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        const audioTypes = [
            ContentType.Mp3
        ];

        return this.getAttachmentsByType(interaction, audioTypes);
    }

    getImageAttachments(interaction: Message | ButtonInteraction): Attachment[] {
        const imageTypes = [
            ContentType.Jpeg,
            ContentType.Jpg,
            ContentType.Png,
            ContentType.WebP
        ];

        return this.getAttachmentsByType(interaction, imageTypes);
    }
}
