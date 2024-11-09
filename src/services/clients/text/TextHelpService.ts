import { BaseHelpService } from '../../help/BaseHelpService.js';
import { IHelpService } from '../../help/IHelpService.js';
import { IServiceContainer } from '../../IServiceContainer.js';
import { LargeLanguageModelActionRow } from '../chat/discord/components/buttonRows/LargeLanguageModelActionRow.js';

export class TextHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    constructor(services: IServiceContainer) {
        super();

        this.#services = services;
    }

    buildHelpArticle(): string {
        let helpArticle: string = '# Musebot Help'
            + '\n\n'
            + 'Thanks for using Musebot! This instance of Musebot is configured as a large language model service.'
            + '\n\n'
            + 'You can interact with this chatbot by mentioning it with "@" plus its name followed by the image you want it to generate.'
            + 'Additionally, there are various button-based interactions you can use after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new LargeLanguageModelActionRow(this.#services);
        helpArticle += this.buildHelpArticleFromActionRows(actionRows);

        return helpArticle;
    }
}
