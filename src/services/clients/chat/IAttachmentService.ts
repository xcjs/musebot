import { ContentType } from '../../../enums/ContentType.js';

export interface IAttachmentService<AttachmentType> {
    getAttachments(interaction: unknown): AttachmentType[];

    getAttachmentsByType(interaction: unknown, contentTypes: ContentType[] | undefined): AttachmentType[];

    getAudioAttachments(interaction: unknown): AttachmentType[];

    getImageAttachments(interaction: unknown): AttachmentType[];

    getMediaAttachments(interaction: unknown): AttachmentType[];

    getAttachedImagesAsBase64(interaction: unknown): Promise<string[]>;
}
