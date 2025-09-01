import { Prompt } from 'comfy-ui-client';
import { Message } from 'discord.js';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { IReplyRenderTask } from '../../tasks/IReplyRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiReplyAudioTask extends ComfyUiBaseTask implements IReplyRenderTask {
    #environmentSettings: IEnvironmentSettings;

    #workflowService: IWorkflowService;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #logger: ILogger;

    #message: Message;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, message: Message) {
        super(services);

        this.#environmentSettings = services.environmentSettings;

        this.#workflowService = services.workflowService;
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;

        this.#logger = services.getLogger('ComfyUiReplyAudioTask');

        this.#message = message;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiReplyAudioTask...');

        const prompt = this.#replyService.getMessageWithoutBotMentions(this.#message);

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Txt2Audio);

        const renderRequests: SerializableRenderRequest[] = [];
        const prompts: Prompt[] = [];
        let numRenders = 1;
        let i = 0;

        do {
            const workflow = getRandomArrayEntry(workflows);

            this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

            const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);

            if (i === 0) {
                numRenders = renderRequest.num;
            }

            // Some audio models that are music models accept separate prompts
            // for music genre and lyrics.
            const promptSeparator = '\n\n';

            if(prompt.indexOf(promptSeparator) > 0) {
                renderRequest.prompt = prompt.split(promptSeparator)[0].trim();
                renderRequest.prompt2 = prompt.substring(
                    prompt.indexOf(promptSeparator), prompt.length).trim();
            } else {
                renderRequest.prompt = prompt;
            }

            renderRequest.workflow = workflow.name;
            renderRequest.num = 1;
            renderRequest.refreshSeed();
            renderRequest.refreshDuration();

            renderRequests.push(renderRequest);

            prompts.push(this.#workflowService.renderWorkflow(workflow, renderRequest));
            i++;
        } while (i < numRenders);

        const audiosResponse = await this.#comfyUiClient.render(prompts);
        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: renderRequests,
            response: audiosResponse
        };

        await this.#comfyUiReplyService.reply(this.#message, {}, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#message);
        }
    }
}
