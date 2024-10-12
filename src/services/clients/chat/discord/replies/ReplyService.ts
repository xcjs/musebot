import { BaseReplyService } from './BaseReplyService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export class ReplyService extends BaseReplyService {
    constructor(services: IServiceContainer) {
        super(services);
    }
}
