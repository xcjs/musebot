import { ButtonInteraction } from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IHttpExchange } from '../../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class RandomPromptMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Randomize];
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

    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #taskQueue: ITaskQueue;

    #contentMessage = '';

    constructor(services: IServiceContainer) {
        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#taskQueue = services.taskQueue;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        // This parameter is required by the interface.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);
        mutatedRequest.prompt = await this.#getRandomPrompt();

        this.#contentMessage = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol.` +
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        ` They present ${interaction.member?.user.toString() || 'you'} with this.`;

        return await Promise.resolve(mutatedRequest);
    }

    async #getRandomPrompt(): Promise<string> {
        return new Promise((resolve) => {
            const prompt = getRandomArrayEntry(this.#environmentSettings.stableDiffusionOllamaPrompts);
            const task = this.#services.getLlmGenerateTask(prompt);

            const callback = (payload: IHttpExchange<GenerateRequest, GenerateResponse>) => {
                resolve(payload.response.response);
            };

            task.onSuccess = callback;
            this.#taskQueue.add(task);
        });
    }
}
