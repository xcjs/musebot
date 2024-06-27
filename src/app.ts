import { EnvironmentSettings } from './models/EnvironmentSettings';
import { ShardingManagerManager } from './services/ShardingManagerManager';

const environmentSettings = new EnvironmentSettings();

const botFilePath = 'bot.js';
const shardingManagerManager = new ShardingManagerManager(environmentSettings, botFilePath);

shardingManagerManager.spawn();
