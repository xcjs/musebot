import { IServiceContainer } from '../../../../IServiceContainer.js';
import { IWorkflow } from '../models/IWorkflow.js';

export class BaseTask {
    constructor(services: IServiceContainer) {

    }

    getRandomWorkflow(workflowTypes: Array<IWorkflow>): IWorkflow {

    }
}
