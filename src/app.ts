import { EnvironmentSettings } from './models/EnvironmentSettings';
import { ShardingManagerManager } from './services/ShardingManagerManager';

const environmentSettings = new EnvironmentSettings();
const shardingManagerManager = new ShardingManagerManager(environmentSettings, './bot.js');

shardingManagerManager.spawn();
