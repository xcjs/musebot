import { AttachmentBuilder, Message } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { getRandomInt } from '../../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { OllamaClient } from '../../../../llm/ollama/OllamaClient.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { songPromptMetadataRequestData, SongPromptMetadataRequestType } from '../../models/music/SongPromptMetadataRequestType.js';
import { SongPromptTypeRequestType, songPromptTypeRequestTypeData } from '../../models/music/SongPromptTypeRequestType.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class MessageToMusicMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Message];
    }

    get types(): SupportedFeature[] {
        return [SupportedFeature.Txt2Music];
    }

    get contentMessage() {
        return '';
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #ollamaClient: OllamaClient;
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#ollamaClient = services.ollamaClient;
        this.#replyService = services.replyService;
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = this.#replyService.getMessageWithoutBotMentions(interaction);

        // Music models can contain up to two prompts - one for music
        // genre/style and one for lyrics.
        const promptSeparator = '\n\n';

        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        const songRequestTypeExchange = await this.#ollamaClient.generateStructured<SongPromptTypeRequestType>(prompt, songPromptTypeRequestTypeData);
        const songPromptMetadataExchange = await this.#ollamaClient.generateStructured<SongPromptMetadataRequestType>(prompt, songPromptMetadataRequestData);

        mutatedRequest.bpm = songPromptMetadataExchange.data.bpm;
        mutatedRequest.keyScale = songPromptMetadataExchange.data.keyScale;
        mutatedRequest.timeSignature = songPromptMetadataExchange.data.timeSignature;

        if (prompt.indexOf(promptSeparator) > 0
        && songRequestTypeExchange.data.promptHasTags
        && songRequestTypeExchange.data.promptHasLyrics) {
            mutatedRequest.prompt = prompt.split(promptSeparator)[0].trim();
            mutatedRequest.prompt2 = prompt.substring(
                prompt.indexOf(promptSeparator), prompt.length).trim();
        } else {
            if (!songRequestTypeExchange.data.promptHasTags) {
                mutatedRequest.prompt = songPromptMetadataExchange.data.tags.join(', ');
            } else {
                mutatedRequest.prompt = prompt;
            }

            if (!songRequestTypeExchange.data.promptHasLyrics) {
                mutatedRequest.prompt2 = songPromptMetadataExchange.data.lyrics;
            }

        }

        if (mutatedRequest.durationMin !== undefined
            && mutatedRequest.durationMax !== undefined) {
            mutatedRequest.duration = getRandomInt(mutatedRequest.durationMin, mutatedRequest.durationMax);
        }

        mutatedRequest.workflow = workflow.name;
        mutatedRequest.refreshSeed();

        return await Promise.resolve(mutatedRequest);
    }
}
