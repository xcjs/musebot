import { PromptStatus } from './enums/PromptStatus.js';

export interface IPromptStatus {
    status_str: string;
    completed: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: Array<Array<Record<PromptStatus, Record<string, any>>>>;
}
