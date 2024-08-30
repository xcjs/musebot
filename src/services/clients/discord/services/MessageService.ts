import { Attachment, ButtonInteraction, Message } from 'discord.js';
import { ContentType } from '../../../../enums/ContentType';

export class MessageService {
    constructor() {

    }

    getAttachmentsByType(interaction: Message | ButtonInteraction, contentTypes: Array<ContentType>): Array<Attachment> {
        let attachments: Array<Attachment>;

        if(interaction instanceof Message) {
            attachments = Array.from(interaction.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        } else if(interaction instanceof ButtonInteraction) {
            attachments = Array.from(interaction.message.attachments, ([name, value]) => ({ name, value })).map(x => x.value);
        }

        const matchingAttachments = attachments.filter(attachment =>
            contentTypes.includes(Object.values(ContentType)
                .find(contentTypeValue => contentTypeValue === attachment.contentType)));

        return matchingAttachments;
    }
}
