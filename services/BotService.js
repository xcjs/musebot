export class BotService {
    #discordClient = null;
    #easyDiffusionClient = null;

    constructor(discordClient, easyDiffusionClient) {
        this.#discordClient = discordClient;
        this.#easyDiffusionClient = easyDiffusionClient;
    }
}
