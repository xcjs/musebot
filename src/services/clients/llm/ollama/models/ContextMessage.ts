export interface ContextMessage<ChatMessageType, LlmMessageType> {
    messageId: string | null;
    associatedMessageId: string | null;
    userId: string | null;
    associatedUserId: string | null;
    channelId: string | null;
    serverId: string | null;
    timestamp: Date;

    chatMessage: ChatMessageType | null;
    llmMessage: LlmMessageType;

    // When true, preserves the message when context is cleared.
    isReadOnly: boolean;
    isPrivate: boolean;
}
