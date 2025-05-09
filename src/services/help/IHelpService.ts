import { Interaction } from 'discord.js';

export interface IHelpService {
    buildHelpArticle(interaction: Interaction): Promise<string>;
}
