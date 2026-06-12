import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { ILogger } from './ILogger.js';

export class Logger implements ILogger {
    static longestPrefix = 0;
    static longestBotId = 0;

    get prefix(): string {
        let paddedBotId = this.#botId ?? '';

        while (paddedBotId.length < Logger.longestBotId) {
            paddedBotId += ' ';
        }

        let paddedPrefix = `${this.#prefix}`;

        while (paddedPrefix.length < Logger.longestPrefix) {
            paddedPrefix += ' ';
        }

        const botIdPart = Logger.longestBotId > 0 ? `${paddedBotId} | ` : '';

        return `${new Date().toLocaleString('sv').replace(' ', 'T')} | ${botIdPart}${paddedPrefix} | `;
    }

    get isDebug(): boolean {
        return process.debugPort !== null && process.debugPort > 0;
    }

    #prefix: string = '';
    #botId: string | null = null;

    constructor(prefix: string, botId?: string) {
        this.#prefix = prefix;

        if (botId) {
            this.#botId = botId;

            if (Logger.longestBotId < botId.length) {
                Logger.longestBotId = botId.length;
            }
        }

        if (Logger.longestPrefix < prefix.length) {
            Logger.longestPrefix = prefix.length;
        }
    }

    debug(message: string, ...args: unknown[]): void {
        if (process.env.NODE_ENV !== NodeEnvironment.Development.toString()) {
            return;
        }

        if (args.length > 0) {
            console.debug(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)));
        } else {
            console.debug(this.#formatMessage(message));
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (args.length > 0) {
            console.info(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.info(this.#formatMessage(message));
        }
    }

    success(message: string, ...args: unknown[]): void {
        if (args.length > 0) {
            console.log(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.log(this.#formatMessage(message));
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (args.length > 0) {
            console.warn(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.warn(this.#formatMessage(message));
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (args.length > 0) {
            console.error(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.error(this.#formatMessage(message));
        }
    }

    fatal(message: string, ...args: unknown[]): void {
        if (args.length > 0) {
            console.error(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.error(this.#formatMessage(message));
        }
    }

    #formatMessage(message: string): string {
        return `${this.prefix}${message}`
    }

    #jsonifyArgs(args: unknown[]): string[] {
        return args.map((arg) => {
            return JSON.stringify(arg, null, 2);
        });
    }
}
