import { IActionRows } from '../clients/chat/discord/components/buttonRows/IActionRows.js';

export abstract class BaseHelpService {
    constructor() {

    }

    protected buildHelpArticleFromActionRows(actionRows: IActionRows): string {
        let helpArticle = '';
        actionRows.build();

        actionRows.buttons.forEach(button => {
            helpArticle += `* **\`${button.label}\` ${button.title}**`;
            helpArticle += ` - ${button.helpText}\n\n`;
        });

        return helpArticle;
    }
}
