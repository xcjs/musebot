import { AttachmentBuilder, BaseMessageOptions, ButtonInteraction } from 'discord.js';

import { MAX_FILE_NAME_LENGTH,MAX_TEXT_LINE_LENGTH } from '../../../../../constants/FileConstants.js';
import { BufferEncoding } from '../../../../../enums/BufferEncoding.js';
import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { getRandomArrayEntry } from '../../../../../utilities/random-utilities.js';
import { wrapText } from '../../../../../utilities/string-utilities.js';
import { IEnvironmentSettings } from '../../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { ILogger } from '../../../../ILogger.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { ComfyUiReplyService } from '../../../chat/discord/comfy-ui/ComfyUiReplyService.js';
import { IReplyService } from '../../../chat/IReplyService.js';
import { OllamaClient } from '../../../llm/ollama/OllamaClient.js';
import { IRandomRenderTask } from '../../tasks/IRandomRenderTask.js';
import { ComfyUiClient } from '../ComfyUiClient.js';
import { MediaCollectionResponse } from '../extensions/MediaResponse.js';
import { SerializableRenderRequest } from '../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../services/IWorkflowService.js';
import { ComfyUiBaseTask } from './ComfyUiBaseTask.js';

export class ComfyUiRandomRenderTask extends ComfyUiBaseTask implements IRandomRenderTask {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #workflowService: IWorkflowService;
    #ollamaClient: OllamaClient;
    #comfyUiClient: ComfyUiClient;
    #comfyUiReplyService: ComfyUiReplyService;
    #replyService: IReplyService;
    #logger: ILogger;

    #interaction: ButtonInteraction;

    override get taskChannel(): string {
        return `${this.#environmentSettings.stableDiffusionTaskChannel}_${this.#comfyUiClient.host}`;
    }

    constructor(services: IServiceContainer, interaction: ButtonInteraction) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#workflowService = services.workflowService;
        this.#ollamaClient = new OllamaClient(this.#services);
        this.#comfyUiClient = services.comfyUiClient;
        this.#comfyUiReplyService = services.comfyUiReplyService;
        this.#replyService = services.replyService;
        this.#logger = services.getLogger('ComfyUiRandomRenderTask');

        this.#interaction = interaction;
    }

    override async process(): Promise<void> {
        await super.process();

        this.#logger.info('Processing a ComfyUiRandomRenderTask...');

        const workflows = this.#workflowService.workflows.filter(x =>
            x.type === SupportedFeature.Txt2Img
            || x.type === SupportedFeature.Txt2Vid);

        const workflow = getRandomArrayEntry(workflows);

        this.#logger.info(`Using ${workflow.name} as the selected workflow.`);

        const ollamaPrompt = getRandomArrayEntry(this.#environmentSettings.stableDiffusionOllamaPrompts);
        const ollamaExchange = await this.#ollamaClient.generate(ollamaPrompt);

        const renderRequest = this.#workflowService.getWorkflowDefaults(workflow);
        renderRequest.prompt = ollamaExchange.response.response;
        renderRequest.workflow = workflow.name;
        renderRequest.num = 1;
        renderRequest.refreshSeed();

        const prompt = this.#workflowService.renderWorkflow(workflow, renderRequest);
        const imagesResponse = await this.#comfyUiClient.render([prompt]);

        const exchange: IHttpExchange<SerializableRenderRequest[], MediaCollectionResponse> = {
            request: [renderRequest],
            response: imagesResponse
        };

        const content = `Two AIs whisper to each other over the the ancient \`TCP/IP\` protocol.` +
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            ` They present ${this.#interaction.member?.user.toString() || 'you'} with this.`;

        const promptBuffer = Buffer.from(wrapText(renderRequest.prompt, MAX_TEXT_LINE_LENGTH).trim(),
            BufferEncoding.UTF8);

        const promptAttachment = new AttachmentBuilder(promptBuffer, {
            name: `${renderRequest.prompt.substring(0, MAX_FILE_NAME_LENGTH)}.md`
        });

        const reply: BaseMessageOptions = {
            content,
            files: [promptAttachment]
         };

        await this.#comfyUiReplyService.reply(this.#interaction, reply, false, exchange);
    }

    override async postProcess(): Promise<void> {
        await super.postProcess();

        if (this.taskStatus === TaskStatus.Dead) {
            await this.#replyService.replyWithError(this.#interaction);
        }
    }
}
