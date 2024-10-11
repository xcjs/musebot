import { StreamStatus } from '../../enums/StreamStatus.js';
import { IRenderOutput } from './IRenderOutput.js';
import { ITaskData } from './ITaskData.js';
import { StreamRenderResponse } from './StreamRenderResponse.js';

export interface IStreamResponse {
    step: number | undefined;
    step_time: number | undefined;
    total_steps: number | undefined;

    output: Array<IRenderOutput> | undefined;
    render_request: StreamRenderResponse | undefined;
    status: StreamStatus | undefined;
    task_data: ITaskData | undefined;
}
