import { ButtonInteraction, Client as DiscordClient, Events, Message as DiscordMessage } from 'discord.js';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IWorkflow } from '../../media/comfy-ui/models/IWorkflow.js';
import { SerializableRenderRequest } from '../../media/comfy-ui/models/SerializableRenderRequest.js';
import { IWorkflowService } from '../../media/comfy-ui/services/IWorkflowService.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeMediaChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #workflowService: IWorkflowService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#workflowService = services.workflowService;
        this.#taskQueue = services.taskQueue;

        this.logger = services.getLogger('GenerativeMediaChatClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteraction.call(self, interaction));
    }

    async #onMessageCreate(message: DiscordMessage): Promise<void> {
        this.logger.info('Discord message created:', message);

        if (!this.#replyService.shouldReply(message, null)) {
            return;
        }

        this.logger.info('Replying to message...');
        await this.#typingService.startTyping(message);

        this.#taskQueue.add(this.#services.getMessageTask(message) as BaseTask<void>);
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Beginning interaction response to custom action:', interaction);

        try {
            await interaction.deferUpdate();
        } catch (error) {
            this.logger.error(`Error while deferring a reply. Ignore this error if `
                + `${this.#environmentSettings.applicationName} is functioning normally:`, error);
        }

        if(Object.values(BotInteraction).includes(interaction.customId as BotInteraction)) {
            this.#taskQueue.add(this.#services.getInteractionTask(interaction));
        } else {
            await this.#onCustomInteraction(interaction);
        }

        await this.#typingService.startTyping(interaction);
    }

    async #onCustomInteraction(interaction: ButtonInteraction) {
        let isWorkflowInteraction = false;
        let workflow: IWorkflow;

        try {
            await this.#workflowService.loadWorkflows();
            const workflows = this.#workflowService.workflows;

            let renderRequest: SerializableRenderRequest;

            isWorkflowInteraction = !!workflows.find((workflowInstance) => {
                renderRequest = this.#workflowService.getWorkflowDefaults(workflowInstance);

                if (renderRequest.label === interaction.customId) {
                    workflow = workflowInstance;
                    return true;
                }
            });
        } catch (error) {
            isWorkflowInteraction = false;
            this.logger.error('An exception occurred while trying to process the interaction:', interaction);
            this.logger.error('As this is a custom workflow, verify your workflow defaults are configured correctly:', error);
        }

        if (isWorkflowInteraction) {
            this.#taskQueue.add(this.#services.getCustomInteractionTask(interaction, workflow) as BaseTask<void>);
        } else {
            this.logger.warn('An unknown or erroneous interaction was passed:', interaction);
        }
    }
}
