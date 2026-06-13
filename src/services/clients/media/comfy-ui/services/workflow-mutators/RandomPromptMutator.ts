import { AttachmentBuilder, ButtonInteraction } from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { MAX_FILE_NAME_LENGTH, MAX_TEXT_LINE_LENGTH } from '../../../../../../constants/FileConstants.js';
import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { BufferEncoding } from '../../../../../../enums/BufferEncoding.js';
import { IHttpExchange } from '../../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../../utilities/random-utilities.js';
import { wrapText } from '../../../../../../utilities/string-utilities.js';
import { IConfigurationService } from '../../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from "../../../../../IBotServiceContainer.js"
import { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../../../tasks/models/BaseTask.js';
import { OLLAMA_TEMPERATURE_MAX } from '../../../../llm/ollama/constants/OllamaConstants.js';
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

    get additionalAttachments(): AttachmentBuilder[] {
        return this.#additionalAttachments;
    }

    readonly #services: IBotServiceContainer;

    readonly #configurationService: IConfigurationService;
    readonly #taskQueue: ITaskQueue;

    #contentMessage = '';
    readonly #additionalAttachments: AttachmentBuilder[] = [];

    constructor(services: IBotServiceContainer) {
        this.#services = services;

        this.#configurationService = services.configurationService;
        this.#taskQueue = services.taskQueue;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        // This parameter is required by the interface.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);
        mutatedRequest.prompt = (await this.#getRandomPrompt()).trim();

        mutatedRequest.refreshSeed();
        mutatedRequest.refreshDuration();

        this.#contentMessage = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol.` +
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            ` They present ${interaction.member?.user.toString() || 'you'} with this.`;

        return await Promise.resolve(mutatedRequest);
    }

    async #getRandomPrompt(): Promise<string> {
        return new Promise((resolve) => {
            const prompt = getRandomArrayEntry(this.#configurationService.comfyUiOllamaPrompts) || '';
            const task = this.#services.getLlmGenerateTask(prompt, OLLAMA_TEMPERATURE_MAX);
            task.isChild = true;

            const callback = (payload: IHttpExchange<GenerateRequest, GenerateResponse>): void => {
                this.additionalAttachments.push(
                    this.#packageExpandedPromptAsMarkdown(payload.response.response));

                resolve(payload.response.response);
            };

            task.onSuccess = callback;
            this.#taskQueue.add(task as BaseTask<unknown>);
        });
    }

    #packageExpandedPromptAsMarkdown(prompt: string): AttachmentBuilder {
        const promptBuffer = Buffer.from(wrapText(prompt, MAX_TEXT_LINE_LENGTH).trim(),
            BufferEncoding.UTF8);

        return new AttachmentBuilder(promptBuffer, {
            name: `${prompt.substring(0, MAX_FILE_NAME_LENGTH)}.md`
        });
    }
}
