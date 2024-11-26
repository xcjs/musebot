import { IImageOutput } from './IImageOutput.js';
import { IWorkflowNode } from './IWorkflowNode.js';

export interface IPromptHistory {
    // [0]: Prompt Number
    // [1]: Prompt ID
    // [3]: Record<Node ID as a string, workflow node>
    prompt: Array<number | string | Record<string, IWorkflowNode>>;
    // The output record key is the node ID as a string with an available
    // output.
    outputs: Record<string, Array<IImageOutput | object>>;
}
