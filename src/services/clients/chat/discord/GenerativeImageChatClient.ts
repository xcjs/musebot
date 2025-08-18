import { ButtonInteraction, Client as DiscordClient, Events, Message as DiscordMessage, MessageReaction, User } from 'discord.js';
import { Message as OllamaMessage } from 'ollama';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IWorkflow } from '../../media/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from '../../media/comfy-ui/services/IWorkflowService.js';
import { SerializableRenderRequest } from '../../media/comfy-ui/models/SerializableRenderRequest.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeImageChatClient extends BaseDiscordClient {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #discordClient: DiscordClient;
    #replyService: IReplyService;
    #typingService: ITypingService;
    #workflowService: IWorkflowService;
    #helpService: IHelpService;
    #taskQueue: ITaskQueue;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#discordClient = services.discordClient;
        this.#replyService = services.replyService;
        this.#typingService = services.typingService;
        this.#workflowService = services.workflowService;
        this.#helpService = services.helpService;
        this.#taskQueue = services.taskQueue;

        this.logger = services.getLogger('GenerativeImageChatClient');

        this.#registerEvents();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
        this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
        this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteraction.call(self, interaction));
        this.#discordClient.on(Events.MessageReactionAdd, (reaction, user) => void this.#onMessageReactionAdd.call(self, reaction, user));
    }

    async #onMessageCreate(message: DiscordMessage): Promise<void> {
        this.logger.info('Discord message created:', message);

        if (!this.#replyService.shouldReply(message, null)) {
            return;
        }

        this.logger.info('Replying to message...');
        await this.#typingService.startTyping(message);

        if(this.#replyService.getMessageWithoutBotMentions(message).startsWith('{')) {
            this.#taskQueue.add(this.#services.getJsonRenderTask(message) as BaseTask<void>);
        } else {
            this.#taskQueue.add(this.#services.getReplyRenderTask(message) as BaseTask<void>);
        }
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger.info('Beginning interaction response to custom action:', interaction);

        try {
            await interaction.deferUpdate();
        } catch (error) {
            this.logger.error(`Error while deferring a reply. Ignore this error if the `
                + `${this.#environmentSettings.applicationName} is functioning normally:`, error);
        }

        switch (interaction.customId) {
            case BotInteraction.Retry.toString():
                this.#taskQueue.add(this.#services.getRetryRenderTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.ShowSource.toString():
                this.#taskQueue.add(this.#services.getShowSourceTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.GuidanceScaleMinus.toString():
                this.#taskQueue.add(this.#services.getDecreaseGuidanceScaleRenderTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.GuidanceScalePlus.toString():
                this.#taskQueue.add(this.#services.getIncreaseGuidanceScaleRenderTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.ExpandPrompt.toString():
                this.#taskQueue.add(this.#services.getExpandPromptTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.Randomize.toString():
                this.#taskQueue.add(this.#services.getRandomRenderTask(interaction) as BaseTask<void>);
                break;
            case BotInteraction.Help.toString():
                this.#taskQueue.add(this.#services.getReplyTask(
                    interaction, {
                        content: await this.#helpService.buildHelpArticle(interaction),
                    }) as BaseTask<void>);
                break;
            default:
                let isWorkflowInteraction = false;
                let workflow: IWorkflow;

                try {
                    await this.#workflowService.loadWorkflows();
                    const workflows = this.#workflowService.workflows;

                    let renderRequest: SerializableRenderRequest;

                    isWorkflowInteraction = !!workflows.find((workflowInstance) => {
                        renderRequest = this.#workflowService.getWorkflowDefaults(workflowInstance);

                        if(renderRequest.label === interaction.customId) {
                            workflow = workflowInstance;
                            return true;
                        }
                    });
                } catch(error) {
                    isWorkflowInteraction = false;
                    this.logger.error('An exception occurred while trying to process the interaction:', interaction);
                    this.logger.error('As this is a custom workflow, verify your workflow defaults are configured correctly:', error);
                }

                if (isWorkflowInteraction) {
                    this.#taskQueue.add(this.#services.getImg2ImgRenderTask(interaction, workflow) as BaseTask<void>);
                } else {
                    this.logger.warn('An unknown or erroneous interaction was passed:', interaction);
                }

                break;
        }

        await this.#typingService.startTyping(interaction);
    }

    async #onMessageReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
        if(reaction.partial) {
            try {
                reaction = await reaction.fetch();
            } catch (error) {
                this.logger.error('An error occurred while fetching the MessageReaction:', error);
                return;
            }
        }

        if (!this.#replyService.shouldReply(reaction.message as DiscordMessage, reaction)) {
            return;
        }

        await this.#typingService.startTyping(reaction.message as DiscordMessage);

        this.#taskQueue.add(this.#services.getEmojiReactionRenderTask(
            reaction.message as DiscordMessage,
            reaction.emoji,
            user) as BaseTask<OllamaMessage[]>);
    }
}
