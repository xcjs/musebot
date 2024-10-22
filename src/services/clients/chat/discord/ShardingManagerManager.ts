import { Events,ShardingManager } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { IEnvironmentSettings } from '../../../IEnvironmentSettings.js';
import { DiscordEvent } from './enums/DiscordEvent.js';

export class ShardingManagerManager {
    #environmentSettings: IEnvironmentSettings;
    #absoluteBotPath: string;

    #logger;
    #shardingManager: ShardingManager;

    constructor(environmentSettings, absoluteBotPath) {
        this.#environmentSettings = environmentSettings;
        this.#absoluteBotPath = absoluteBotPath;

        this.#logger = new Logger(this.#environmentSettings.isProduction, 'ShardingManagerManager');

        this.#shardingManager = new ShardingManager(this.#absoluteBotPath, { token: this.#environmentSettings.discordToken });

        this.#registerEvents();
    }

    spawn() {
        this.#shardingManager.spawn();
    }

    #registerEvents() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        this.#shardingManager.on(DiscordEvent.ShardCreate, (shard) => this.#onShardCreate.call(self, shard));
    }

    #onShardCreate(shard) {
        this.#logger(LogLevel.Info, `Shard #${shard.id} created.`);

        shard.once(Events.ClientReady, () => {
            shard.send({
                shardID: shard.id,
                logger: this.#logger.data
            });
        });
    }
}
