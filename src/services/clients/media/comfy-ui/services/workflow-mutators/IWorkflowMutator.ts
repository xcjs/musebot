import { ButtonInteraction, Message } from 'discord.js';

import { BotInteraction } from '../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../features/enum/SupportedFeature.js';
import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';

export interface IWorkflowMutator {
    interaction: BotInteraction;
    types: SupportedFeature[];
    mutate(renderRequest: SerializableRenderRequest,
        interaction: Message | ButtonInteraction,
        workflow: IWorkflow): Promise<SerializableRenderRequest>;
}
