export interface ContextMessage<ChatMessageType, LlmMessageType> {
    // Nullable as system messages will not be sourced from the chat and must
    // fit in this model.
    messageId: string | null;
    channelId: string | null;
    serverId: string | null;
    userId: string | null;
    chatMessage: ChatMessageType | null;

    timestamp: Date;

    llmMessage: LlmMessageType;

    // When true, preserves the message when context is cleared.
    isReadOnly: boolean;
}
