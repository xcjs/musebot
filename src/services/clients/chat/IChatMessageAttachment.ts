export interface IChatMessageAttachment {
    readonly name: string;
    readonly data: Buffer;
    readonly description?: string;
}