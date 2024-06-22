import { StreamStatus } from '../../enums/StreamStatus';
import { IRenderOutput } from './IRenderOutput';
import { ITaskData } from './ITaskData';
import { StreamRenderResponse } from './StreamRenderResponse';

export interface IStreamResponse {
    step: number | undefined;
    step_time: number | undefined;
    total_steps: number | undefined;

    status: StreamStatus | undefined;
    render_request: StreamRenderResponse | undefined;
    task_data: ITaskData | undefined;

    output: Array<IRenderOutput> | undefined;
}
