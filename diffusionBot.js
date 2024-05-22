import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageType, Partials } from "discord.js";
import { Logger, LogLevel } from "meklog";
import dotenv from "dotenv";
import axios from "axios";
import { RenderRequest } from "./models/RenderRequest.js";

dotenv.config();

const model = process.env.MODEL;
const servers = process.env.EASYDIFFUSION_HOSTS.split(",").map(url => ({ url: new URL(url), available: true }));
const channels = process.env.CHANNELS.split(",");
const requiresMention = getBoolean(process.env.REQUIRES_MENTION);
const randomServer = getBoolean(process.env.RANDOM_SERVER);

console.log(`model: ${model}`);
console.log(`servers: ${servers.join(', ')}`);
console.log(`channels: ${channels}`);
console.log(`requiresMention: ${requiresMention}`);
console.log(`randomServer: ${randomServer}`);

if (servers.length == 0) {
    throw new Error("No servers available");
}

let log;
process.on("message", data => {
    if (data.shardID) client.shardID = data.shardID;
    if (data.logger) log = new Logger(data.logger);
});

const logError = (error) => {
    if (error.response) {
        let str = `Error ${error.response.status} ${error.response.statusText}: ${error.request.method} ${error.request.path}`;
        if (error.response.data?.error) {
            str += ": " + error.response.data.error;
        }
        log(LogLevel.Error, str);
    } else {
        log(LogLevel.Error, error);
    }
};

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function makeRequest(path, method, data) {
    while (servers.filter(server => server.available).length == 0) {
        // wait until a server is available
        await new Promise(res => setTimeout(res, 1000));
    }

    let error = null;
    // randomly loop through the servers available, don't shuffle the actual array because we want to be notified of any updates
    let order = new Array(servers.length).fill().map((_, i) => i);

    if (randomServer) {
        order = shuffleArray(order);
    }

    for (const j in order) {
        if (!order.hasOwnProperty(j)) continue;
        const i = order[j];
        // try one until it succeeds
        try {
            // make a request to EasyDiffusion
            const url = new URL(servers[i].url); // don't modify the original URL

            servers[i].available = false;

            if (path.startsWith("/")) {
                path = path.substring(1);
            }

            if (!url.pathname.endsWith("/")) {
                url.pathname += "/"; // safety
            }

            url.pathname += path;
            log(LogLevel.Debug, `Making request to ${url}`);

            let result = {};

            result = await axios({
                method, url, data,
                responseType: 'json'
            }).catch((error) => {
                result = error.response;

                if(error.response.status !== 425) {
                    throw error;
                }
            });

            servers[i].available = true;

            return result ? result.data : {};
        } catch (err) {
            servers[i].available = true;
            error = err;
            logError(error);
        }
    }
    if (!error) {
        throw new Error("No servers available");
    }
    throw error;
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    allowedMentions: { users: [], roles: [], repliedUser: false },
    partials: [
        Partials.Channel
    ]
});

client.once(Events.ClientReady, async () => {
    await client.guilds.fetch();
    client.user.setPresence({ activities: [], status: "online" });
});

const messages = {};

function getBoolean(str) {
    return !!str && str != "false" && str != "no" && str != "off" && str != "0";
}

async function replySplitMessage(replyMessage, attachment) {
    const replyMessages = [];

    replyMessages.push(await replyMessage.reply({ files: [attachment] }));

    return replyMessages;
}

client.on(Events.MessageCreate, async message => {
    let typing = false;
    try {
        await message.fetch();

        // return if not in the right channel
        const channelID = message.channel.id;
        if (message.guild && !channels.includes(channelID)) return;

        // return if user is a bot, or non-default message
        if (!message.author.id) return;
        if (message.author.bot || message.author.id == client.user.id) return;

        const botRole = message.guild?.members?.me?.roles?.botRole;
        const myMention = new RegExp(`<@((!?${client.user.id}${botRole ? `)|(&${botRole.id}` : ""}))>`, "g"); // RegExp to match a mention for the bot

        if (typeof message.content !== "string" || message.content.length == 0) {
            return;
        }

        let context = null;
        if (message.type == MessageType.Reply) {
            const reply = await message.fetchReference();
            if (!reply) return;
            if (reply.author.id != client.user.id) return;
            if (messages[channelID] == null) return;
            if ((context = messages[channelID][reply.id]) == null) return;
        } else if (message.type != MessageType.Default) {
            return;
        }

        // deal with commands first before passing to LLM
        let userInput = message.content
            .replace(new RegExp("^\s*" + myMention.source, ""), "").trim();

        if (message.type == MessageType.Default && (requiresMention && message.guild && !message.content.match(myMention))) return;

        if (message.guild) {
            await message.guild.channels.fetch();
            await message.guild.members.fetch();
        }

        userInput = userInput
            .replace(myMention, "")
            .replace(/<#([0-9]+)>/g, (_, id) => {
                if (message.guild) {
                    const chn = message.guild.channels.cache.get(id);
                    if (chn) return `#${chn.name}`;
                }
                return "#unknown-channel";
            })
            .replace(/<@!?([0-9]+)>/g, (_, id) => {
                if (id == message.author.id) return message.author.username;
                if (message.guild) {
                    const mem = message.guild.members.cache.get(id);
                    if (mem) return `@${mem.user.username}`;
                }
                return "@unknown-user";
            })
            .replace(/<:([a-zA-Z0-9_]+):([0-9]+)>/g, (_, name) => {
                return `emoji:${name}:`;
            })
            .trim();

        if (userInput.length == 0) return;

        // create conversation
        if (messages[channelID] == null) {
            messages[channelID] = { amount: 0, last: null };
        }

        // log user's message
        log(LogLevel.Debug, `${message.guild ? `#${message.channel.name}` : "DMs"} - ${message.author.username}: ${userInput}`);

        // start typing
        typing = true;
        await message.channel.sendTyping();
        let typingInterval = setInterval(async () => {
            try {
                await message.channel.sendTyping();
            } catch (error) {
                if (typingInterval != null) {
                    clearInterval(typingInterval);
                }
                typingInterval = null;
            }
        }, 7000);

        let response;
        let statusResponse;

        try {
            // context if the message is not a reply
            if (context == null) {
                context = messages[channelID].last;
            }

            response = await makeRequest('/render', 'post', new RenderRequest(model, userInput));

            do {
                statusResponse = await makeRequest(response.stream, 'get');
                await sleep(1000);
            } while (statusResponse.status !== 'succeeded');
        } catch (error) {
            if (typingInterval != null) {
                clearInterval(typingInterval);
            }
            typingInterval = null;
            throw error;
        }

        if (typingInterval != null) {
            clearInterval(typingInterval);
        }

        typingInterval = null;

        const imageBuffer = new Buffer.from(statusResponse.output[0].data.split(",")[1], "base64");
        const attachment = new AttachmentBuilder(imageBuffer);

        // reply (will automatically stop typing)
        await replySplitMessage(message, attachment);
    } catch (error) {
        if (typing) {
            try {
                // return error
                await message.reply({ content: "The dreams would not form for me this time. Maybe they will answer our call later." });
            } catch (ignored) { }
        }
        logError(error);
    }
});

client.login(process.env.TOKEN);
