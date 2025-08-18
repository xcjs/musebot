import { Interaction, Message } from 'discord.js';

import { IWorkflow } from '../../models/IWorkflow.js';
import { SerializableRenderRequest } from '../../models/SerializableRenderRequest.js';

export interface IRenderRequestMutator {
    mutate(renderRequest: SerializableRenderRequest, interaction: Message | Interaction, workflow: IWorkflow): Promise<SerializableRenderRequest>;
}
