import fs from 'node:fs/promises'
import path from 'node:path';

import { Prompt } from 'comfy-ui-client';
import Handlebars from 'handlebars';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowDefaults } from '../models/IWorkflowDefaults.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from './IWorkflowService.js';

export class WorkflowService implements IWorkflowService {
    get hasWorkflows(): boolean {
        return this.#workflows.length > 0;
    }

    get workflows(): IWorkflow[] {
        return this.#workflows;
    }

    readonly #logger: ILogger;

    #workflows: IWorkflow[] = [];

    public constructor(services: IServiceContainer) {
        this.#logger = services.getLogger('WorkflowService');
    }

    async loadWorkflows(): Promise<void> {
        this.#logger.info('Loading ComfyUI workflows...');

        if(this.#workflows.length > 0) {
            this.#workflows = [];
        }

        const workflowPathBase = './workflows';
        const workflowTypes = Object.values(SupportedFeature);

        try {
            for (const workflowType of workflowTypes) {
                this.#logger.info(`Checking if the ${workflowType} directory exists...`);

                const workflowDir = path.join(workflowPathBase, workflowType);

                try {
                    await fs.access(workflowDir);
                } catch {
                    this.#logger.warn(`Could not access ${workflowDir}.`
                        + ` This is fine if if you don't need ${workflowType} workflows.`);
                    continue;
                }

                this.#logger.info(`Reading the directory contents of ${workflowType}...`);
                const directoryContents = await fs.readdir(workflowDir, { withFileTypes: true });

                for(const fsItem of directoryContents) {
                    if(fsItem.isFile() && fsItem.name.endsWith('.json')) {
                        const templatePath = path.join(workflowDir, fsItem.name);

                        this.#logger.info(`Reading the contents of ${templatePath} as a workflow template...`);

                        const fileContents = await fs.readFile(templatePath, BufferEncoding.UTF8);

                        this.#workflows.push({
                            // Windows hosts need the double backslash replaced.
                            name: templatePath.replaceAll('\\', '/'),
                            type: workflowType,
                            workflowString: fileContents
                        });
                    }
                }
            }
        } catch(error) {
            this.#logger.error('Failed to load workflow templates.'
                 + ' Check if Musebot can read and write from ./workflows/ and that it contains workflows.', error);
        }
    }

    hasWorkflowType(workflowType: SupportedFeature): boolean {
        return this.#workflows.some(workflow => workflow.type === workflowType);
    }

    getWorkflowDefaults(workflow: IWorkflow): SerializableRenderRequest {
        try {
            const renderRequestObj = (JSON.parse(workflow.workflowString) as IWorkflowDefaults).$musebotDefaults;

            // Not every template will contain defaults.
            if(renderRequestObj !== null && renderRequestObj !== undefined) {
                return SerializableRenderRequest.fromSerializableRenderRequest(renderRequestObj);
            } else {
                return new SerializableRenderRequest();
            }
        } catch (error) {
            this.#logger.error(
                `Failed to fetch the workflow defaults for ${workflow.name}.`
                + ` Does the $musebotSerializableRenderRequest property exist, or does it match the documented schema?`
                , error);

            return new SerializableRenderRequest();
        }
    }

    renderWorkflow(workflow: IWorkflow, renderRequest: SerializableRenderRequest): Prompt {
        this.#logger.info(`Rendering workflow template ${workflow.name}`);

        const destructiveRenderRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        // Filter characters that will break the JSON encoding.
        if(destructiveRenderRequest.prompt?.length || 0 > 0) {
            destructiveRenderRequest.prompt = JSON.stringify(destructiveRenderRequest.prompt);
            destructiveRenderRequest.prompt = destructiveRenderRequest.prompt
                .substring(1, destructiveRenderRequest.prompt.length - 1);
        }

        if (destructiveRenderRequest.prompt2?.length || 0 > 0) {
            destructiveRenderRequest.prompt2 = JSON.stringify(destructiveRenderRequest.prompt2);
            destructiveRenderRequest.prompt2 = destructiveRenderRequest.prompt2
                .substring(1, destructiveRenderRequest.prompt2.length - 1);
        }

        if(destructiveRenderRequest.promptNegative?.length || 0 > 0) {
            destructiveRenderRequest.promptNegative = JSON.stringify(destructiveRenderRequest.promptNegative);
            destructiveRenderRequest.promptNegative = destructiveRenderRequest.promptNegative
                .substring(1, destructiveRenderRequest.promptNegative.length - 1);
        }

        const template = Handlebars.compile(workflow.workflowString);
        const templateString = template(destructiveRenderRequest);

        return JSON.parse(templateString) as Prompt;
    }
}
