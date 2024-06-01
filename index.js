import { path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EnvironmentSettings } from './models/EnvironmentSettings';
import { ShardingManagerManager } from './services/ShardingManagerManager';

const environmentSettings = new EnvironmentSettings();

const botFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bot.js');
const shardingManagerManager = new ShardingManagerManager(environmentSettings, botFilePath);

shardingManagerManager.spawn();
