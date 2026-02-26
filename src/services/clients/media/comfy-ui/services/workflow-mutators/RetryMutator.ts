import { AttachmentBuilder, ButtonInteraction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { getRandomArrayEntry } from '../../../../../../utilities/random-utilities.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IServiceContainer } from '../../../../../IServiceContainer.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';
import { IWorkflowService } from '../IWorkflowService.js';
import { IWorkflowMutator } from './IWorkflowMutator.js';

export class RetryMutator implements IWorkflowMutator {
    get interactions(): BotInteraction[] {
        return [BotInteraction.Retry];
    }

    get types(): SupportedFeature[] {
        return [
            SupportedFeature.Txt2Audio,
            SupportedFeature.Txt2Img,
            SupportedFeature.Txt2Music,
            SupportedFeature.Txt2Vid
        ];
    }

    get contentMessage(): string {
        return this.#contentMessage;
    }

    get additionalAttachments(): AttachmentBuilder[] {
        return [];
    }

    #workflowService: IWorkflowService;
    #contentMessage = '';

    constructor(services: IServiceContainer) {
        this.#workflowService = services.workflowService;
    }

    async mutate(renderRequest: SerializableRenderRequest,
        interaction: ButtonInteraction,
        workflow: IWorkflow): Promise<SerializableRenderRequest>
    {
        const mutatedRequest = SerializableRenderRequest.fromSerializableRenderRequest(renderRequest);

        const newWorkflow = getRandomArrayEntry(this.#workflowService.workflows.filter(x => x.type === workflow.type));
        const workflowDefaults = this.#workflowService.getWorkflowDefaults(newWorkflow);

        mutatedRequest.workflow = newWorkflow.name;
        mutatedRequest.refreshSeed();
        mutatedRequest.refreshDuration();

        // Set width and height even if it's not an img workflow - worst case it
        // gets reassigned to undefined or unused by the workflow template.
        mutatedRequest.width = workflowDefaults.width;
        mutatedRequest.height = workflowDefaults.height;

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        this.#contentMessage = `${interaction.member?.user.toString() || 'You'} retried \`${mutatedRequest.prompt }\``

        return await Promise.resolve(mutatedRequest);
    }
}
