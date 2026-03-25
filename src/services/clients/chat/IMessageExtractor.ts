export interface IMessageExtractor<MessageType> {
    extractPrompt(message: MessageType): string;

    getPreviousMessage(message: MessageType): Promise<MessageType | null>;
}
