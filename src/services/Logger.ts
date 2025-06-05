import { consola } from 'consola';

import { ILogger } from './ILogger.js';

export class Logger implements ILogger {
    #logger: consola.ConsolaInstance;

    constructor(prefix: string) {
        this.#logger = consola.withTag(prefix);
    }

    debug(message: string, ...args: unknown[]) {
        if(args.length > 0) {
            this.#logger.debug(message, args);
        } else {
            this.#logger.debug(message);
        }
    }

    info(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            this.#logger.info(message, args);
        } else {
            this.#logger.info(message);
        }
    }

    success(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            this.#logger.success(message, args);
        } else {
            this.#logger.success(message);
        }
    }

    warn(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            this.#logger.warn(message, args);
        } else {
            this.#logger.warn(message);
        }
    }

    error(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            this.#logger.error(message, args);
        } else {
            this.#logger.error(message);
        }
    }

    fatal(message: string, ...args: unknown[]) {
        if (args.length > 0) {
            this.#logger.fatal(message, args);
        } else {
            this.#logger.fatal(message);
        }
    }
}
