import { Client as DiscordClient, Events, Message as DiscordMessage } from 'discord.js';

import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IWorkflowService } from '../../images/comfy-ui/services/IWorkflowService.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeAudioChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #workflowService: IWorkflowService;
    #helpService: IHelpService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#workflowService = services.workflowService;
        this.#helpService = services.helpService;
        this.#taskQueue = services.taskQueue;

        this.logger = services.getLogger('GenerativeAudioChatClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
    }

    async #onMessageCreate(message: DiscordMessage): Promise<void> {
        this.logger.info('Discord message created:', message);

        if (!this.#replyService.shouldReply(message, null)) {
            return;
        }

        this.#taskQueue.add(this.#services.getReplyRenderTask(message) as BaseTask<void>);

        this.logger.info('Replying to message...');
        await this.#typingService.startTyping(message);
    }
}
