import { IChatMessageAttachment } from './IChatMessageAttachment.js';

export interface IChatMessage {
    content: string;
    attachments: IChatMessageAttachment[];
}