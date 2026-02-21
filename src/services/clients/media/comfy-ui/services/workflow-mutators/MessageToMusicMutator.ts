import { AttachmentBuilder, Message } from 'discord.js';
import { GenerateRequest, GenerateResponse } from 'ollama';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { IHttpExchangeWithAttachedData } from '../../../../../../models/IHttpExchangeWithAttachedData.js';
import { getRandomArrayEntry, getRandomInt } from '../../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { ITaskQueue } from '../../../../../tasks/ITaskQueue.js';
import { IReplyService } from '../../../../chat/IReplyService.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { BpmConstants } from '../../models/music/BpmConstants.js';
import { KeyScale } from '../../models/music/KeyScale.js';
import { SongPromptMetadata, songPromptMetadataRequestData } from '../../models/music/SongPromptMetadataRequestType.js';
import { SongPromptType } from '../../models/music/SongPromptType.js';
import { SongPromptRequestType, songPromptTypeRequestTypeData } from '../../models/music/SongPromptTypeRequestType.js';
import { TimeSignature } from '../../models/music/TimeSignature.js';
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

    #services: IServiceContainer;
    #featureService: IFeatureService;
    #taskQueue: ITaskQueue;
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        this.#services = services;
        this.#featureService = services.featureService;
        this.#taskQueue = services.taskQueue;
        this.#replyService = services.replyService;
    }

    async mutate(renderRequest: SerializableRenderRequest, interaction: Message, workflow: IWorkflow): Promise<SerializableRenderRequest> {
        const prompt = this.#replyService.getMessageWithoutBotMentions(interaction);

        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        const songRequestType = await this.#getSongPromptType(prompt);
        const songPromptMetadata = await this.#getSongPromptMetadata(prompt, songRequestType);

        mutatedRequest.prompt = songPromptMetadata.tags.join(', ');
        mutatedRequest.prompt2 = songPromptMetadata.lyrics;

        mutatedRequest.bpm = songPromptMetadata.bpm;
        mutatedRequest.keyScale = songPromptMetadata.keyScale;
        mutatedRequest.timeSignature = songPromptMetadata.timeSignature;

        if (mutatedRequest.durationMin !== undefined
            && mutatedRequest.durationMax !== undefined) {
            mutatedRequest.duration = getRandomInt(mutatedRequest.durationMin, mutatedRequest.durationMax);
        }

        mutatedRequest.workflow = workflow.name;
        mutatedRequest.refreshSeed();

        return await Promise.resolve(mutatedRequest);
    }

    async #getSongPromptType(prompt: string): Promise<SongPromptRequestType & { tags: string[], lyrics: string }> {
        // Music models can contain up to two prompts - one for music
        // genre/style and one for lyrics.
        const promptSeparator = '\n\n';
        let tags: string[] = []
        let lyrics = '';

        if (prompt.indexOf(promptSeparator) > 0) {
            tags = prompt.split(promptSeparator)[0].split(',').map(x => x.trim());
            lyrics = prompt.substring(
                prompt.indexOf(promptSeparator), prompt.length).trim();
        } else {
            tags = prompt.split(',').map(x => x.trim());
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            return new Promise((resolve) => {
                const task = this.#services.getLlmGenerateStructuredTask<SongPromptRequestType>(prompt, songPromptTypeRequestTypeData);

                const callback = (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, SongPromptRequestType>) => {
                    resolve({
                        ...payload.data,
                        tags,
                        lyrics
                    });
                };

                task.onSuccess = callback;
                this.#taskQueue.add(task);
            });
        } else {
            const promptHasLyrics = lyrics.length > 0;

            return Promise.resolve({
                songPromptType: promptHasLyrics ? SongPromptType.Lyrical : SongPromptType.Instrumental,
                promptHasTags: tags.length > 0 ? true : false,
                promptHasLyrics,
                tags,
                lyrics
            });
        }
    }

    async #getSongPromptMetadata(prompt: string, songPromptRequestType: SongPromptRequestType & { tags: string[], lyrics: string }): Promise<SongPromptMetadata> {
        if(this.#featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            return new Promise((resolve) => {
                const task = this.#services.getLlmGenerateStructuredTask<SongPromptMetadata>(prompt, songPromptMetadataRequestData);

                const callback = (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, SongPromptMetadata>) => {
                    // If user-provided lyrics are present, prioritize those over what
                    // the LLM generates. This allows "weird" lyrical prompts to
                    // function as expected.
                    if (songPromptRequestType.promptHasLyrics
                        && songPromptRequestType.lyrics !== payload.data.lyrics
                    ) {
                        payload.data.lyrics = songPromptRequestType.lyrics
                    }

                    resolve(payload.data);
                };

                task.onSuccess = callback;
                this.#taskQueue.add(task);
            });
        } else {
            return Promise.resolve({
                timeSignature: getRandomArrayEntry(Object.values(TimeSignature)) as TimeSignature,
                bpm: getRandomInt(BpmConstants.min, BpmConstants.max),
                keyScale: getRandomArrayEntry(Object.values(KeyScale)),
                songPromptType: SongPromptType.Instrumental,
                tags: songPromptRequestType.tags,
                lyrics: songPromptRequestType.lyrics
            });
        }
    }
}
