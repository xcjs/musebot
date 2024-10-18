import { ServiceContainer } from './services/ServiceContainer.js';

const services = new ServiceContainer();
const client = services.generativeChatClient;
client.login();
