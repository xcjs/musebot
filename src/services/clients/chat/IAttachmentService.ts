import { ContentType } from '../../../enums/ContentType.js';

export interface IAttachmentService<AttachmentType> {
    getAttachments(interaction: any): AttachmentType[];

    getAttachmentsByType(interaction: any, contentTypes: ContentType[] | undefined): AttachmentType[];

    getAudioAttachments(interaction: any): AttachmentType[];

    getImageAttachments(interaction: any): AttachmentType[];

    getAttachedImagesAsBase64(interaction: any): Promise<string[]>;
}
