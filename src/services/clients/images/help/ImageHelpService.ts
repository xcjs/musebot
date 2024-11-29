import { Interaction } from 'discord.js';

import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { StatefulImageGenerationActionRows } from '../../chat/discord/components/buttonRows/StatefulImageGenerationActionRows.js';

export class ImageHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;
    }

    buildHelpArticle(interaction: Interaction): string {
        let helpArticle: string = `# Musebot Help for ${interaction.user}`
            + '\n\n'
            + 'Thanks for using Musebot! This instance of Musebot is configured as an image generation service.'
            + '\n\n'
            + `You can interact with this chatbot by mentioning it with ${this.replyService.mention(this.discordClient.user)} followed by a description of the image you want to generate.`
            + ' Additionally, there are various button-based interactions you can use to adjust the image generated after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new StatefulImageGenerationActionRows(this.#services, null);
        helpArticle += this.buildHelpArticleFromActionRows(actionRows);

        return helpArticle;
    }
}
