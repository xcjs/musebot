import { Prompt } from 'comfy-ui-client';

import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IWorkflow } from '../models/IWorkflow.js';

export interface IWorkflowService {
    hasWorkflows: boolean;
    workflows: Array<IWorkflow>;
    loadWorkflows(): Promise<void>;
    getWorkflowDefaults(workflow: IWorkflow): SerializableRenderRequest;
    renderWorkflow(workflow: IWorkflow, renderRequest: SerializableRenderRequest): Prompt;
}
