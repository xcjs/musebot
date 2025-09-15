import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../../models/IHttpExchange.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
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

    #services: IServiceContainer;

    #taskQueue: ITaskQueue;
    #contentMessage = '';

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#taskQueue = services.taskQueue;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        mutatedRequest.prompt = await this.#getExpandedPrompt(mutatedRequest.prompt, workflow.type);

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        this.#contentMessage = `${interaction.member?.user.toString() || 'You'} expanded the detail in \`${renderRequest.prompt }\``

        return await Promise.resolve(mutatedRequest);
    }

    async #getExpandedPrompt(prompt: string, feature: SupportedFeature): Promise<string> {
        return new Promise((resolve) => {
            prompt = `The following is a prompt used to generate a piece of media from ${feature} ` +
                ` - expand it with meticulous detail so it can be generated better: ${prompt}`;

            const task = this.#services.getLlmGenerateTask(prompt);

            const callback = (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => {
                resolve(payload.response.response);
            };

            task.onSuccess = callback;
            this.#taskQueue.add(task);
        });
    }
}
