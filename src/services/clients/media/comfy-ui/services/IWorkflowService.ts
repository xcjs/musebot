import { Prompt } from 'comfy-ui-client';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflow } from '../models/IWorkflow.js';

export interface IWorkflowService {
    hasWorkflows: boolean;
    workflows: Array<IWorkflow>;
    loadWorkflows(): Promise<void>;
    hasWorkflowType(workflowType: SupportedFeature): boolean;
    getWorkflowDefaults(workflow: IWorkflow): SerializableRenderRequest;
    renderWorkflow(workflow: IWorkflow, renderRequest: SerializableRenderRequest): Prompt;
}
