import { ButtonInteraction, Client as DiscordClient, Events, Message, MessageReaction, User } from 'discord.js';

import { BotInteraction } from '../../../../enums/BotInteraction.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { ITaskQueue } from '../../../tasks/ITaskQueue.js';
import { BaseTask } from '../../../tasks/models/BaseTask.js';
import { IWorkflow } from '../../images/comfy-ui/models/IWorkflow.js';
import { IWorkflowService } from '../../images/comfy-ui/services/IWorkflowService.js';
import { SerializableRenderRequest } from '../../images/stable-diffusion/models/SerializableRenderRequest.js';
import { IReplyService } from '../IReplyService.js';
import { ITypingService } from '../ITypingService.js';
import { BaseDiscordClient } from './BaseDiscordClient.js';

export class GenerativeImageChatClient extends BaseDiscordClient {
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

    async #onMessageCreate(message: Message): Promise<void> {
        this.logger.info(`Discord message created. ${message.author.displayName} (${message.author.username}): "${message.content}"`);

        if (!this.#replyService.shouldReply(message, null)) {
            return;
        }

        this.logger.info('Replying to message...');
        await this.#typingService.startTyping(message);

        if(this.#replyService.getMessageWithoutBotMentions(message).startsWith('{')) {
            this.#taskQueue.add(this.#services.getJsonRenderTask(message) as BaseTask);
        } else {
            this.#taskQueue.add(this.#services.getReplyRenderTask(message) as BaseTask);
        }
    }

    async #onInteraction(interaction: ButtonInteraction): Promise<void> {
        this.logger.info(`Beginning interaction response to custom action "${interaction.customId}"...`);

        try {
            await interaction.deferUpdate();
        } catch (error) {
            this.logger.error(`Something went wrong while deferring a reply: ${error}. Ignore this error if the bot is functioning normally.`);
        }

        switch (interaction.customId) {
            case BotInteraction.Retry.toString():
                this.#taskQueue.add(this.#services.getRetryRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.ShowSource.toString():
                this.#taskQueue.add(this.#services.getShowSourceTask(interaction) as BaseTask);
                break;
            case BotInteraction.GuidanceScaleMinus.toString():
                this.#taskQueue.add(this.#services.getDecreaseGuidanceScaleRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.GuidanceScalePlus.toString():
                this.#taskQueue.add(this.#services.getIncreaseGuidanceScaleRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.ExpandPrompt.toString():
                this.#taskQueue.add(this.#services.getExpandPromptTask(interaction) as BaseTask);
                break;
            case BotInteraction.Randomize.toString():
                this.#taskQueue.add(this.#services.getRandomRenderTask(interaction) as BaseTask);
                break;
            case BotInteraction.Help.toString():
                this.#taskQueue.add(this.#services.getReplyTask(
                    interaction, {
                        content: await this.#helpService.buildHelpArticle(interaction),
                    }) as BaseTask);
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
                    this.logger.error(`An exception occurred while trying to process the interaction "${interaction.customId}"`);
                    this.logger.error(`As this is a custom workflow, verify your workflow defaults are configured correctly: ${error}`);
                }

                if (isWorkflowInteraction) {
                    this.#taskQueue.add(this.#services.getImg2ImgRenderTask(interaction, workflow) as BaseTask);
                } else {
                    this.logger.warning(`An unknown or erroneous interaction was passed: ${interaction.customId}.`);
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
                this.logger.error(`Something went wrong when fetching the MessageReaction: ${error}.`);
                return;
            }
        }

        if (!this.#replyService.shouldReply(reaction.message as Message, reaction)) {
            return;
        }

        await this.#typingService.startTyping(reaction.message as Message);

        this.#taskQueue.add(this.#services.getEmojiReactionRenderTask(
            reaction.message as Message,
            reaction.emoji,
            user) as BaseTask);
    }
}
