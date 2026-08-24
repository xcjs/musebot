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
  isReadOnly: boolean;
  isPrivate: boolean;
  isSummary: boolean;
}