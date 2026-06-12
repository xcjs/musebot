import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../../models/IHttpExchange.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../../tasks/models/BaseTask.js';
import { OLLAMA_TEMPERATURE_DEFAULT } from '../../../../llm/ollama/constants/OllamaConstants.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class ExpandPromptMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.ExpandPrompt];
    }

    get types(): SupportedFeature[] {
        return [
            SupportedFeature.Txt2Audio,
            SupportedFeature.Txt2Img,
            SupportedFeature.Txt2Vid
        ];
    }

    get contentMessage(): string {
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    readonly #services: IBotServiceContainer;

    readonly #taskQueue: ITaskQueue;

    #contentMessage = '';

    constructor(services: IBotServiceContainer) {
        this.#services = services;

        this.#taskQueue = services.taskQueue;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        if(mutatedRequest.prompt === null) {
            throw new Error('The prompt could be expanded because no original prompt was found.');
        }

        mutatedRequest.prompt = await this.#getExpandedPrompt(mutatedRequest.prompt, workflow.type);

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        this.#contentMessage = `${interaction.member?.user.toString() || 'You'} expanded the detail in \`${renderRequest.prompt }\``

        return await Promise.resolve(mutatedRequest);
    }

    async #getExpandedPrompt(prompt: string, feature: SupportedFeature): Promise<string> {
        return new Promise((resolve) => {
            prompt = `The following is a prompt used to generate a piece of media from ${feature} ` +
                ` - expand it with meticulous detail to generate better results: ${prompt}`;

            const task = this.#services.getLlmGenerateTask(prompt, OLLAMA_TEMPERATURE_DEFAULT);
            task.isChild = true;

            const callback = (payload: IHttpExchange<GenerateRequest, GenerateResponse>): void => {
                resolve(payload.response.response);
            };

            task.onSuccess = callback;
            this.#taskQueue.add(task as BaseTask<unknown>);
        });
    }
}
