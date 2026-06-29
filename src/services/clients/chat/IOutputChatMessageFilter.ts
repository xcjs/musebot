import { IChatMessage } from './IChatMessage.js';

export interface IOutputChatMessageFilter {
    process(messages: IChatMessage[]): Promise<IChatMessage[]>;
    processStreaming(messages: IChatMessage[], isDone: boolean): Promise<IChatMessage[]>;
}