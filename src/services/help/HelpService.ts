import { BotFunction } from '../../enums/BotFunction.js';
import { LargeLanguageModelActionRow } from '../clients/chat/discord/components/buttonRows/LargeLanguageModelActionRow.js';
import { StatefulImageGenerationActionRows } from '../clients/chat/discord/components/buttonRows/StatefulImageGenerationActionRows.js';
import { IEnvironmentSettings } from '../IEnvironmentSettings.js';
import { IServiceContainer } from '../IServiceContainer.js';
import { IHelpService } from './IHelpService.js';

export class HelpService implements IHelpService {
    #services: IServiceContainer;
    #environmentSettings: IEnvironmentSettings;

    constructor(services: IServiceContainer) {
        this.#services = services;
        this.#environmentSettings = services.environmentSettings;
    }

    buildHelpArticle(): string {
        switch(this.#environmentSettings.botFunction) {
            case BotFunction.Images:
                return this.#buildImageHelpArticle();
            case BotFunction.Text:
                return this.#buildTextHelpArticle();
        }
    }

    #buildImageHelpArticle(): string {
        let helpArticle: string = '# Musebot Help'
            + '\n\n'
            + 'Thanks for using Musebot! This instance of Musebot is configured as an image generation service.'
            + '\n\n'
            + 'You can interact with this chatbot by mentioning it with "@" plus its name followed by a description of the image you want to generate.'
            + ' Additionally, there are various button-based interactions you can use to adjust the image generated after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new StatefulImageGenerationActionRows(this.#services, null);
        actionRows.build();

        actionRows.buttons.forEach(button => {
            helpArticle += `* **\`${button.label}\` ${button.title}**`;
            helpArticle += ` - ${button.helpText}\n\n`;
        });

        return helpArticle;
    }

    #buildTextHelpArticle(): string {
        let helpArticle: string = '# Musebot Help'
            + '\n\n'
            + 'Thanks for using Musebot! This instance of Musebot is configured as a large language model service.'
            + '\n\n'
            + 'You can interact with this chatbot by mentioning it with "@" plus its name followed by the image you want it to generate.'
            + 'Additionally, there are various button-based interactions you can use after interacting with the bot at least once: '
            + '\n\n';

        const actionRows = new LargeLanguageModelActionRow(this.#services);
        actionRows.build();

        actionRows.buttons.forEach(button => {
            helpArticle += `* **\`${button.label}\` ${button.title}**`;
            helpArticle += ` - ${button.helpText}\n\n`;
        });

        return helpArticle;
    }
}
