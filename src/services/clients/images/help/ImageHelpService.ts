import { Interaction } from 'discord.js';

import nodePackage from '../../../../../package.json' with { type: 'json' };
import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { StatefulImageGenerationActionRows } from '../../chat/discord/components/buttonRows/StatefulImageGenerationActionRows.js';
import { IReplyService } from '../../chat/IReplyService.js';

export class ImageHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#replyService = services.replyService;
    }

    buildHelpArticle(interaction: Interaction): string {
        let helpArticle = '# Musebot Help'
            + '\n\n'
            + `Thanks for using Musebot \`v${nodePackage.version}\`, ${this.#replyService.mention(interaction.user)}!`
            + ' This instance of Musebot is configured as an image generation service.'
            + ' For more information on Musebot or to test the latest version of it, visit the [XCJS Discord](https://discord.gg/qZMzFA8Apd).'
            + '\n\n'
            + `You can interact with this chatbot by mentioning it with ${this.replyService.mention(this.discordClient.user)} followed by a description of the image you want to generate.`
            + ' Additionally, there are various button-based interactions you can use to adjust the image generated after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new StatefulImageGenerationActionRows(this.#services, null);
        helpArticle += this.buildHelpArticleFromActionRows(actionRows);

        return helpArticle;
    }
}
