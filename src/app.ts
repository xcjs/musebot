import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EnvironmentSettings } from './models/EnvironmentSettings.js';
import { ShardingManagerManager } from './services/clients/discord/services/ShardingManagerManager.js';

const environmentSettings = new EnvironmentSettings(false);

const botFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bot.js');
const shardingManagerManager = new ShardingManagerManager(environmentSettings, botFilePath);


shardingManagerManager.spawn();
