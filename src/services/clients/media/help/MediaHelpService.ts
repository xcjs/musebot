import { Interaction } from 'discord.js';

import nodePackage from '../../../../../package.json' with { type: 'json' };
import { DEVELOPER } from '../../../../constants/Globals.js';
import { IEnvironmentSettings } from '../../../environment-settings/IEnvironmentSettings.js';
import { SupportedFeature } from '../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../features/IFeatureService.js';
import { BaseHelpService } from '../../../help/BaseHelpService.js';
import { IHelpService } from '../../../help/IHelpService.js';
import { IServiceContainer } from '../../../IServiceContainer.js';
import { Img2ImgActionRow } from '../../chat/discord/components/buttonRows/Img2ImgActionRow.js';
import { StatefulAudioGenerationActionRow } from '../../chat/discord/components/buttonRows/StatefulAudioGenerationActionRow.js';
import { StatefulImageGenerationActionRows } from '../../chat/discord/components/buttonRows/StatefulImageGenerationActionRows.js';
import { DiscordConstants } from '../../chat/discord/enums/DiscordConstants.js';
import { IReplyService } from '../../chat/IReplyService.js';

export class MediaHelpService extends BaseHelpService implements IHelpService {
    #services: IServiceContainer;

    #environmentSettings: IEnvironmentSettings;
    #featureService: IFeatureService;
    #replyService: IReplyService;

    constructor(services: IServiceContainer) {
        super(services);

        this.#services = services;

        this.#environmentSettings = services.environmentSettings;
        this.#featureService = services.featureService;
        this.#replyService = services.replyService;
    }

    async buildHelpArticle(interaction: Interaction): Promise<string> {
        const applicationName = this.#environmentSettings.applicationName;

        const supportedMedia: string[] = [];

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Audio)) {
            supportedMedia.push('audio');
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            supportedMedia.push('image(s)');
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Music)) {
            supportedMedia.push('music');
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Vid)) {
            supportedMedia.push('video');
        }

        if(supportedMedia.length === 0) {
            supportedMedia.push(`nothing - ask your ${applicationName} administrator to add workflow templates.`)
        } else if(supportedMedia.length > 1) {
            supportedMedia[supportedMedia.length - 1] = `or ${supportedMedia[supportedMedia.length - 1]}`
        }

        let helpArticle = `# ${applicationName} Help`
            + '\n\n'
            + `Thanks for using ${applicationName} \`v${nodePackage.version}\`, ${this.#replyService.mention(interaction.user)}!`
            + ` This instance of ${applicationName} is configured as a media generation service currently capable of creating ${supportedMedia.join(', ')}.`
            + ` For more information on ${applicationName} or to test the latest version of it, visit the [${DEVELOPER} Discord](<${DiscordConstants.InviteLink}>).`
            + '\n\n'
            + `You can interact with this chatbot by mentioning it with ${this.replyService.mention(this.discordClient.user)} followed by a description of the ${supportedMedia.join(', ')} you want to generate.`
            + ' Additionally, there are various button-based interactions you can use to adjust the generated media after interacting with the bot at least once: '
            + '\n\n';

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Audio)) {
            const actionRows = new StatefulAudioGenerationActionRow(this.#services, null);
            helpArticle += '## Audio Generation\n\n';
            helpArticle += await this.buildHelpArticleFromActionRows(actionRows);
        }

        if(this.#featureService.hasFeature(SupportedFeature.Txt2Img)) {
            const actionRows = new StatefulImageGenerationActionRows(this.#services, null);
            helpArticle += '## Image Generation\n\n';
            helpArticle += await this.buildHelpArticleFromActionRows(actionRows);
        }

        if(this.#featureService.hasFeature(SupportedFeature.Img2Img)) {
            const actionRows = new Img2ImgActionRow(this.#services);
            helpArticle += '## Image to Image Generation\n\n';
            helpArticle += await this.buildHelpArticleFromActionRows(actionRows);
        }

        if (this.#featureService.hasFeature(SupportedFeature.Txt2Music)
        ) {
            const actionRows = new StatefulAudioGenerationActionRow(this.#services, null);
            helpArticle += '## Music Generation\n\n';

            helpArticle += '### ACE-Step\n\n';

            helpArticle += 'ACE-Step is currently the most capable foundational AI music generation model. If this'
            + ` instance of ${applicationName} is using ACE-Step, consider the following tips:\n\n`
            + '#### Tags\n\n'
            + '#### Lyrics\n\n';

            helpArticle += await this.buildHelpArticleFromActionRows(actionRows);
        }

        return helpArticle;
    }
}
