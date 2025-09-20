import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';

export interface IWorkflow {
    name: string;
    workflowString: string;
    type: SupportedFeature;
}
