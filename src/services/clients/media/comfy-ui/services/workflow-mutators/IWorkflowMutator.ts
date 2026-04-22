import { AttachmentBuilder, ButtonInteraction, Message, MessageReaction } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';

export interface IWorkflowMutator {
    interactions: BotInteraction[];
    types: SupportedFeature[];
    contentMessage: string;
    additionalAttachments: AttachmentBuilder[];
    mutate(renderRequest: SerializableRenderRequest,
        interaction: Message | ButtonInteraction | MessageReaction,
        workflow: IWorkflow): Promise<SerializableRenderRequest>;
}
