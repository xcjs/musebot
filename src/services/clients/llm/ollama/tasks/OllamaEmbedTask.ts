import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
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

    readonly #llmChatMessage: LlmChatMessage;
    readonly #ownerUserId: string | undefined;
    readonly #memoryService: IMemoryService;

    #onSuccess: () => void = () => { };
    #onFailure: (error: Error) => void = () => { };

    constructor(services: IBotServiceContainer, llmChatMessage: LlmChatMessage, ownerUserId?: string) {
        super(services);
        this.logger = services.getLogger('OllamaEmbedTask');
        this.#llmChatMessage = llmChatMessage;
        this.#ownerUserId = ownerUserId;
        this.#memoryService = services.getMemoryService();
    }

    override async process(): Promise<void> {
        await this.#memoryService.store(this.#llmChatMessage, this.#ownerUserId);
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