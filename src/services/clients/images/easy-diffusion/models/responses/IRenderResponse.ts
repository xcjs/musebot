import { RenderStatus } from '../../enums/RenderStatus.js'

export interface IRenderResponse {
    status: RenderStatus;
    queue: number;
    stream: string;
    task: number;
}
