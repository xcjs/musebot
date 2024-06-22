import { RenderStatus } from '../../enums/RenderStatus'

export interface IRenderResponse {
    status: RenderStatus;
    queue: number;
    stream: string;
    task: number;
}
