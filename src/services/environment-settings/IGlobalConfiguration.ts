import { TaskQueueStrategy } from '../../enums/TaskQueueStrategy.js';

export interface IGlobalConfiguration {
    taskQueue: {
        numAttempts: number;
        retryDelayMs: number;
        strategy: TaskQueueStrategy;
        forceSerialAcrossHosts: boolean;
    };

    comfyUi?: {
        minVramFreeRatio?: number;
    };
}