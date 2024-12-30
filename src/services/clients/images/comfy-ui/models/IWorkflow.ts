import { WorkflowType } from '../enums/WorkflowType.js';

export interface IWorkflow {
    name: string;
    workflowString: string;
    type: WorkflowType;
}
