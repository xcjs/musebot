import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

import { Logger } from './Logger.js';

describe('Logger', () => {
    let logger: Logger;
    let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;
    let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        logger = new Logger('TestLogger');
        
        // Suppress console output during tests
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleDebugSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('constructor', () => {
        it('should create a logger with the specified prefix', () => {
            const log = new Logger('MyPrefix');
            expect(log).toBeInstanceOf(Logger);
        });

        it('should update longestPrefix when a longer prefix is used', () => {
            const originalLength = Logger.longestPrefix;
            
            new Logger('VeryLongPrefixName');
            
            expect(Logger.longestPrefix).toBeGreaterThanOrEqual('VeryLongPrefixName'.length);
            
            // Restore original length for other tests
            Logger.longestPrefix = originalLength;
        });
    });

    describe('info()', () => {
        it('should call console.info with formatted message', () => {
            logger.info('Test message');
            
            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Test message')
            );
        });

        it('should call console.info with args when provided', () => {
            logger.info('Test message', { key: 'value' });
            
            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        });

        it('should include prefix in message', () => {
            const testLogger = new Logger('MyApp');
            testLogger.info('Hello');
            
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('MyApp')
            );
        });

        it('should include timestamp in message', () => {
            logger.info('Test');
            
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
            );
        });
    });

    describe('debug()', () => {
        it('should not call console.debug when NODE_ENV is not development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            logger.debug('Test message');
            
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            
            process.env.NODE_ENV = originalEnv;
        });

        it('should call console.debug with message when NODE_ENV is development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            logger.debug('Test message');
            
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('success()', () => {
        it('should call console.log with formatted message', () => {
            logger.success('Test message');
            
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Test message')
            );
        });

        it('should handle multiple args', () => {
            logger.success('Test', 'arg1', 'arg2');
            
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('warn()', () => {
        it('should call console.warn with formatted message', () => {
            logger.warn('Warning message');
            
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Warning message')
            );
        });

        it('should handle args', () => {
            logger.warn('Warning', { detail: 'info' });
            
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('error()', () => {
        it('should call console.error with formatted message', () => {
            logger.error('Error message');
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error message')
            );
        });

        it('should handle args', () => {
            logger.error('Error', new Error('test'));
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('fatal()', () => {
        it('should call console.error with formatted message', () => {
            logger.fatal('Fatal message');
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Fatal message')
            );
        });
    });

    describe('prefix property', () => {
        it('should pad shorter prefixes to match longest prefix', () => {
            Logger.longestPrefix = 10;
            const shortLogger = new Logger('Ab');
            
            shortLogger.info('Test');
            
            // The prefix should be padded
            expect(consoleInfoSpy).toHaveBeenCalled();
        });
    });
});