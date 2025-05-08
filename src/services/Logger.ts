/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Logger as MekLogger, LogLevel } from 'meklog';

import { ILogger } from './ILogger.js';
import { IServiceContainer } from './IServiceContainer.js';

export class Logger implements ILogger {
    #logger;

    constructor(services: IServiceContainer, prefix: string) {
        this.#logger = new MekLogger(services.environmentSettings.isProduction, prefix);
    }

    debug(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Warning, message, args);
    }

    info(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Info, message, args);
    }

    success(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Success, message, args);
    }

    warning(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Warning, message, args);
    }

    error(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Error, message, args);
    }

    fatal(message: string, ...args: unknown[]) {
        this.#log(LogLevel.Fatal, message, args);
    }

    #log(logLevel: LogLevel, message: string, args: unknown[]) {
        args = args || [];

        if (args.length > 0) {
            const argString = args.map(arg => JSON.stringify(arg)).join('\n\n');
            this.#logger(logLevel, `${argString}`);
        } else {
            this.#logger(logLevel, message);
        }
    }
}
