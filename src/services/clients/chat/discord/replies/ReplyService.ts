import { IServiceContainer } from '../../../../IServiceContainer.js';
import { BaseReplyService } from './BaseReplyService.js';

export class ReplyService extends BaseReplyService {
    constructor(services: IServiceContainer) {
        super(services);
    }
}
