import { REST, Routes, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

import { IConfigurationService } from '../../../../environment-settings/IConfigurationService.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ILogger } from '../../../../ILogger.js';

export class DiscordSlashCommandRegistrar {
    readonly #services: IBotServiceContainer;
    readonly #configurationService: IConfigurationService;
    readonly #featureService: IFeatureService;
    readonly #logger: ILogger;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
        this.#configurationService = services.configurationService;
        this.#featureService = services.featureService;
        this.#logger = services.getLogger('SlashCommandRegistrar');
    }

    async registerCommands(clientId: string): Promise<void> {
        const commands: Array<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder> = [];

        if (this.#featureService.hasFeature(SupportedFeature.LongTermMemory)) {
            const memoryCommand = new SlashCommandBuilder()
                .setName('memory')
                .setDescription('Manage your long-term memory with the bot')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remember')
                        .setDescription('Opt in to long-term memory. The bot will backfill all accessible messages.'))
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('forget')
                        .setDescription('Opt out of long-term memory. All your stored memories will be deleted.'));

            commands.push(memoryCommand);
        }

        const rest = new REST().setToken(this.#configurationService.discordToken);

        try {
            this.#logger.info(`Registering ${commands.length} slash commands globally...`);

            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );

            this.#logger.info('Slash commands registered successfully.');
        } catch (error) {
            this.#logger.error('Failed to register slash commands:', error);
        }
    }
}