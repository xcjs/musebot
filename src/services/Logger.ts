import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { ILogger } from './ILogger.js';

export class Logger implements ILogger {
    static longestPrefix = 0;

    get prefix() {
        let paddedPrefix = `${this.#prefix}`;

        while (paddedPrefix.length < Logger.longestPrefix) {
            paddedPrefix += ' ';
        }

        return `${new Date().toLocaleString('sv').replace(' ', 'T')} | ${paddedPrefix} | `;
    }

    get isDebug() {
        return process.debugPort !== null && process.debugPort > 0;
    }

    #prefix: string = '';

    constructor(prefix: string) {
        this.#prefix = prefix;

        if (Logger.longestPrefix < prefix.length) {
            Logger.longestPrefix = prefix.length;
        }
    }

    debug(message: string, ...args: unknown[]) {
        if (process.env.NODE_ENV !== NodeEnvironment.Development.toString()) {
            return;
        }

        if (args.length > 0) {
            console.debug(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)));
        } else {
            console.debug(this.#formatMessage(message));
        }
    }

    info(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.info(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.info(this.#formatMessage(message));
        }
    }

    success(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.log(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.log(this.#formatMessage(message));
        }
    }

    warn(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.warn(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.warn(this.#formatMessage(message));
        }
    }

    error(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            console.error(this.#formatMessage(message), ...(this.isDebug ? args : this.#jsonifyArgs(args)))
        } else {
            console.error(this.#formatMessage(message));
        }
    }

    fatal(message: string, ...args: unknown[]) {
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
