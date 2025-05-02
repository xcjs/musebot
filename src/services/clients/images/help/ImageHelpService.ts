import { Interaction } from 'discord.js';

import nodePackage from '../../../../../package.json' with { type: 'json' };
import { APPLICATION_NAME, DEVELOPER } from '../../../../constants/Globals.js';
import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { StatefulImageGenerationActionRows } from '../../chat/discord/components/buttonRows/StatefulImageGenerationActionRows.js';
import { DiscordConstants } from '../../chat/discord/enums/DiscordConstants.js';
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
        let helpArticle = `# ${APPLICATION_NAME} Help`
            + '\n\n'
            + `Thanks for using ${APPLICATION_NAME} \`v${nodePackage.version}\`, ${this.#replyService.mention(interaction.user)}!`
            + ` This instance of ${APPLICATION_NAME} is configured as an image generation service.`
            + ` For more information on ${APPLICATION_NAME} or to test the latest version of it, visit the [${DEVELOPER} Discord](<${DiscordConstants.InviteLink}>).`
            + '\n\n'
            + `You can interact with this chatbot by mentioning it with ${this.replyService.mention(this.discordClient.user)} followed by a description of the image you want to generate.`
            + ' Additionally, there are various button-based interactions you can use to adjust the image generated after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new StatefulImageGenerationActionRows(this.#services, null);
        helpArticle += this.buildHelpArticleFromActionRows(actionRows);

        return helpArticle;
    }
}
