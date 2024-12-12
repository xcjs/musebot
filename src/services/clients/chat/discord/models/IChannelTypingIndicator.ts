export interface IChannelTypingIndicator {
    channelId: string;
    typingInterval: NodeJS.Timeout | null;
}
