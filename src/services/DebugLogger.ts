import { ILogger } from './ILogger.js';

export class DebugLogger implements ILogger {
    static longestPrefix = 0;

    get prefix() {
        let paddedPrefix = this.#prefix;

        while(paddedPrefix.length < DebugLogger.longestPrefix) {
            paddedPrefix += ' ';
        }

        return `${paddedPrefix} | `;
    }

    #prefix: string = '';

    constructor(prefix: string) {
        this.#prefix = prefix;

        if(DebugLogger.longestPrefix < prefix.length) {
            DebugLogger.longestPrefix = prefix.length;
        }
    }

    debug(message: string, ...args: unknown[]) {
        if(args.length > 0) {
            console.debug(this.#formatMessage(message), args);
        } else {
            console.debug(this.#formatMessage(message));
        }
    }

    info(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.info(this.#formatMessage(message), args);
        } else {
            console.info(this.#formatMessage(message));
        }
    }

    success(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.log(this.#formatMessage(message), args);
        } else {
            console.log(this.#formatMessage(message));
        }
    }

    warn(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.warn(this.#formatMessage(message), args);
        } else {
            console.warn(this.#formatMessage(message));
        }
    }

    error(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.error(this.#formatMessage(message), args);
        } else {
            console.error(this.#formatMessage(message));
        }
    }

    fatal(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.error(this.#formatMessage(message), args);
        } else {
            console.error(this.#formatMessage(message));
        }
    }

    #formatMessage(message: string): string {
        return `${this.prefix}${message}`
    }
}
