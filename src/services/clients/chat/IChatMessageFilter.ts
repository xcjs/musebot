import { IChatMessage } from './IChatMessage.js';

export interface IChatMessageFilter {
    process(messages: IChatMessage[]): IChatMessage[];
    processStreaming(messages: IChatMessage[], isDone: boolean): IChatMessage[];
}