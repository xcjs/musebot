export interface ILogger {
    debug(message: string, ...args: unknown[]);
    info(message: string, ...args: unknown[]);
    success(message: string, ...args: unknown[]);
    warning(message: string, ...args: unknown[]);
    error(message: string, ...args: unknown[]);
    fatal(message: string, ...args: unknown[]);
}
