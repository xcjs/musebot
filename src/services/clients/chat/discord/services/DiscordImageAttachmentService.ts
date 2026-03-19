import sharp from 'sharp';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { ButtonInteraction, Message } from 'discord.js';
import { ContentType } from '../../../../../enums/ContentType.js';
import { DiscordAttachmentService } from './DiscordAttachmentService.js';

export class DiscordImageAttachmentService {
    #attachmentService: DiscordAttachmentService;

    constructor(attachmentService: DiscordAttachmentService) {
        this.#attachmentService = attachmentService;
    }

    async getAttachedImagesAsBase64(interaction: Message | ButtonInteraction): Promise<string[]> {
        const imageAttachments = this.#attachmentService.getImageAttachments(interaction);
        const imagesAsBase64: string[] = [];

        if(imageAttachments.length === 0) {
            return imagesAsBase64;
        }

        for (const attachment of imageAttachments) {
            const imageResponse = await fetch(attachment.url);
            let imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

            const sharpImage = sharp(imageBuffer);
            imageBuffer = await sharpImage.toBuffer() as Buffer<ArrayBuffer>;

            imagesAsBase64.push(imageBuffer.toString(BufferEncoding.Base64));
        }

        return imagesAsBase64;
    }
}
