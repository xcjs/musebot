import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IMemoryService } from '../../services/IMemoryService.js';
import { LlmChatMessage } from '../models/LlmChatMessage.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaEmbedTask extends OllamaBaseTask<void> {
    override set onSuccess(callback: () => void) {
        this.#onSuccess = callback;
    }

    override set onFailure(callback: (error: Error) => void) {
        this.#onFailure = callback;
    }

    readonly #services: IBotServiceContainer;
    readonly #llmChatMessage: LlmChatMessage;
    readonly #ownerUserId: string | undefined;
    readonly #memoryService: IMemoryService;
    readonly #featureService: IFeatureService;

    #onSuccess: () => void = () => { };
    #onFailure: (error: Error) => void = () => { };

    constructor(services: IBotServiceContainer, llmChatMessage: LlmChatMessage, ownerUserId?: string) {
        super(services);
        this.logger = services.getLogger('OllamaEmbedTask');
        this.#services = services;
        this.#llmChatMessage = llmChatMessage;
        this.#ownerUserId = ownerUserId;
        this.#memoryService = services.getMemoryService();
        this.#featureService = services.featureService;
    }

    override async process(): Promise<void> {
        this.logger.debug(`process() starting for messageId=${this.#llmChatMessage.messageId} (attachments=${this.#llmChatMessage.attachments.length}).`);

        if (this.#llmChatMessage.messageId !== null
            && await this.#memoryService.hasMessage(this.#llmChatMessage.messageId)) {
            this.logger.debug(`process() skipping: messageId=${this.#llmChatMessage.messageId} already stored.`);
            return;
        }

        await this.#interpretAttachments();
        this.logger.debug(`process() calling memoryService.store() for messageId=${this.#llmChatMessage.messageId}.`);
        await this.#memoryService.store(this.#llmChatMessage, this.#ownerUserId);
        this.logger.debug(`process() completed for messageId=${this.#llmChatMessage.messageId}.`);
    }

    async #interpretAttachments(): Promise<void> {
        const attachments = this.#llmChatMessage.attachments;

        if (attachments.length === 0) {
            return;
        }

        if (!this.#featureService.hasFeature(SupportedFeature.Vision)) {
            return;
        }

        const needsInterpretation = attachments.some(a => a.interpretation.length === 0);
        if (!needsInterpretation) {
            return;
        }

        const contextPrompt = `The user posted: "${this.#llmChatMessage.message}"`;
        const client = this.#services.ollamaClient;

        for (const attachment of attachments) {
            if (attachment.interpretation.length > 0) {
                continue;
            }

            try {
                const response = await fetch(attachment.url);
                const buffer = Buffer.from(await response.arrayBuffer());
                const base64 = buffer.toString('base64');

                attachment.interpretation = await client.interpretImages([base64], contextPrompt);
                this.logger.info(`Interpreted attachment '${attachment.filename}'.`);
            } catch (error) {
                this.logger.error(`Failed to interpret attachment '${attachment.filename}':`, error);
            }
        }
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        switch (this.taskStatus) {
            case TaskStatus.Successful:
                this.#onSuccess();
                break;
            case TaskStatus.Dead:
                this.#onFailure(this.lastError ?? new Error('Embed task died without a captured error.'));
                break;
        }
    }
}