import { IChatMessage } from './IChatMessage.js';

export interface IChatMessageFilter {
    process(messages: IChatMessage[]): Promise<IChatMessage[]>;
    processStreaming(messages: IChatMessage[], isDone: boolean): Promise<IChatMessage[]>;
}