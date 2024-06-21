import { StreamStatus } from '../../enums/StreamStatus';
import { RenderOutput } from './RenderOutput';
import { TaskData } from './TaskData';
import { RenderRequest } from '../requests/RenderRequest';

export class StreamResponse {
    step: number | undefined;
    step_time: number | undefined;
    total_steps: number | undefined;

    status: StreamStatus | undefined;
    render_request: RenderRequest | undefined;
    task_data: TaskData | undefined;

    output: Array<RenderOutput> | undefined = [];

    constructor() {

    }
}
