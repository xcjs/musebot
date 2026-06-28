export interface LlmChatMessage {
    messageId: string | null;
    username: string;
    displayName: string;
    userId: string;
    isBot: boolean;
    message: string;
    datetime: string;
    roles: Array<{ id: string; name: string }>;
    channel: {
        id: string;
        name: string | null;
        topic: string | null;
    };
    thread: {
        id: string;
        name: string;
        parentId: string | null;
    } | null;
    server: {
        id: string | null;
        name: string | null;
    };
    mentions: {
        users: Array<{ id: string; username: string; displayName: string; isBot: boolean }>;
        roles: Array<{ id: string; name: string }>;
        everyone: boolean;
    };
}