import fs from 'node:fs/promises'
import path from 'node:path';

import { Prompt } from 'comfy-ui-client';
import { Logger, LogLevel } from 'meklog';
import * as mustache from 'mustache';

import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { SerializableRenderRequest } from '../../stable-diffusion/models/SerializableRenderRequest.js';
import { IWorkflow } from '../models/IWorkflow.js';
import { IWorkflowDefaults } from '../models/IWorkflowDefaults.js';
import { IWorkflowService } from './IWorkflowService.js';

export class WorkflowService implements IWorkflowService {
    get hasWorkflows(): boolean {
        return this.#workflows.length > 0;
    }

    get workflows(): Array<IWorkflow> {
        return this.#workflows;
    }

    #environmentSettings: IEnvironmentSettings;

    #logger;

    #workflows: Array<IWorkflow> = [];

    public constructor(services: IServiceContainer) {
        this.#environmentSettings = services.environmentSettings;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'WorkflowService');
    }

    async loadWorkflows(): Promise<void> {
        this.#logger(LogLevel.Info, 'Loading ComfyUI workflows...');

        if(this.#workflows.length > 0) {
            this.#workflows = [];
        }

        const workflowPathBase = './workflows';
        const workflowTypes = Object.values(SupportedFeature);

        try {
            for (const workflowType of workflowTypes) {
                this.#logger(LogLevel.Info, `Checking if the ${workflowType} directory exists...`);

                const workflowDir = path.join(workflowPathBase, workflowType);

                try {
                    await fs.access(workflowDir);
                } catch {
                    this.#logger(LogLevel.Warning, `Could not access ${workflowDir}.`
                        + ` This is fine if if you don't need ${workflowType} workflows.`);
                    continue;
                }

                this.#logger(LogLevel.Info, `Reading the directory contents of ${workflowType}...`);
                const directoryContents = await fs.readdir(workflowDir, { withFileTypes: true });

                for(const fsItem of directoryContents) {
                    if(fsItem.isFile && fsItem.name.endsWith('.json')) {
                        const templatePath = path.join(workflowDir, fsItem.name);

                        this.#logger(LogLevel.Info, `Reading the contents of ${templatePath} as a workflow template...`);

                        const fileContents = await fs.readFile(templatePath, BufferEncoding.UTF8);

                        this.#workflows.push({
                            name: templatePath,
                            type: workflowType,
                            workflowString: fileContents
                        });
                    }
                }
            }
        } catch(error) {
            this.#logger(LogLevel.Error, 'Failed to load workflow templates.'
                 + ' Check if Musebot can read and write from ./workflows/ and that it contains workflows.', error);
        }
    }

    hasWorkflowType(workflowType: SupportedFeature): boolean {
        return this.#workflows.find(workflow => workflow.type === workflowType) !== undefined;
    }

    getWorkflowDefaults(workflow: IWorkflow): SerializableRenderRequest {
        try {
            const renderRequestObj = (JSON.parse(workflow.workflowString) as IWorkflowDefaults).$musebotDefaults as SerializableRenderRequest;

            // Not every template will contain defaults.
            if(renderRequestObj !== null && renderRequestObj !== undefined) {
                return SerializableRenderRequest.fromSerializableRenderRequest(renderRequestObj);
            } else {
                return new SerializableRenderRequest;
            }
        } catch (error) {
            this.#logger(LogLevel.Error,
                `Failed to fetch the workflow defaults for ${workflow.name}.`
                + ` Does the $musebotSerializableRenderRequest property exist, or does it match the documented schema?`
                , error);

            return new SerializableRenderRequest();
        }
    }

    renderWorkflow(workflow: IWorkflow, renderRequest: SerializableRenderRequest): Prompt {
        this.#logger(LogLevel.Info, `Rendering workflow template ${workflow.name}`);

        const destructiveRenderRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        // Filter characters that will break the JSON encoding.
        if(destructiveRenderRequest.prompt.length > 0) {
            destructiveRenderRequest.prompt = JSON.stringify(destructiveRenderRequest.prompt);
            destructiveRenderRequest.prompt = destructiveRenderRequest.prompt.substring(1, destructiveRenderRequest.prompt.length - 1);
        }

        if(destructiveRenderRequest.promptNegative?.length > 0) {
            destructiveRenderRequest.promptNegative = JSON.stringify(destructiveRenderRequest.promptNegative);
            destructiveRenderRequest.promptNegative = destructiveRenderRequest.promptNegative.substring(1, destructiveRenderRequest.promptNegative.length - 1);
        }

        const templateString = mustache.default.render(workflow.workflowString, destructiveRenderRequest);
        return JSON.parse(templateString) as Prompt;
    }
}
