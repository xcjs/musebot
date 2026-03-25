export interface IReplyFilter<MessageType, ReactionType> {
    shouldReply(message: MessageType, reaction: ReactionType | null): boolean;
}
