import { ShardingManager, Events } from 'discord.js';
import { Logger, LogLevel } from 'meklog';

import { discordEvents } from '../enums/discordEvents.js';

export class ShardingManagerManager {
    #environmentSettings = null;
    #absoluteBotPath = null;

    #logger = null;
    #shardingManager = null;

    constructor(environmentSettings, absoluteBotPath) {
        this.#environmentSettings = environmentSettings;
        this.#absoluteBotPath = absoluteBotPath;

        this.#logger = new Logger(this.isProduction, 'ShardingManagerManager');

        this.#shardingManager = new ShardingManager(this.#absoluteBotPath, { token: this.#environmentSettings.discordToken });

        this.#registerEvents();
    }

    spawn() {
        this.#shardingManager.spawn();
    }

    #registerEvents() {
        this.#shardingManager.on(discordEvents.shardCreate, this.#onShardCreate);
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
