export enum ResourceType {
    None = 'none',

    // Atomic Resource Types
    Chat = 'Chat',
    Media = 'Media',
    LargeLanguageModel = 'LargeLanguageModel',

    // Merged Resource Types
    GenerativeAI = 'GenerativeAI'
}

export const CHILD_TASK_CHANNEL_SUFFIX = 'Child';
