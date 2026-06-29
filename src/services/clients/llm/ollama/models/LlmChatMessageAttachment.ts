export type LlmChatMessageAttachmentType = 'image' | 'web';

export interface LlmChatMessageAttachment {
    readonly filename: string;
    readonly url: string;
    readonly type: LlmChatMessageAttachmentType;
    interpretation: string;
}