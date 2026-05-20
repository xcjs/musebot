import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IGlobalSettings {
    maxTaskAttempts: number;
    taskRetryDelayMilliseconds: number;
    taskQueueStrategy: TaskQueueStrategy;
    taskQueueForceSerialAcrossHosts: boolean;
}
