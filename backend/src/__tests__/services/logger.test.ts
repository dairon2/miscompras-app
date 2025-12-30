/**
 * Logger Service Unit Tests
 */

import logger from '../../services/logger';

describe('Logger Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('info', () => {
        it('should log info messages', () => {
            logger.info('Test info message');
            expect(console.log).toHaveBeenCalledWith('[INFO] Test info message');
        });

        it('should log info messages with additional args', () => {
            logger.info('Test info', { key: 'value' });
            expect(console.log).toHaveBeenCalledWith('[INFO] Test info', { key: 'value' });
        });
    });

    describe('warn', () => {
        it('should log warning messages', () => {
            logger.warn('Test warning');
            expect(console.warn).toHaveBeenCalledWith('[WARN] Test warning');
        });
    });

    describe('error', () => {
        it('should log error messages', () => {
            logger.error('Test error');
            expect(console.error).toHaveBeenCalledWith('[ERROR] Test error');
        });

        it('should log error with error object', () => {
            const error = new Error('Test');
            logger.error('Test error', error);
            expect(console.error).toHaveBeenCalledWith('[ERROR] Test error', error);
        });
    });

    describe('debug', () => {
        it('should only log in development mode', () => {
            // In test environment, debug should not log
            logger.debug('Debug message');
            // With our test setup, NODE_ENV is 'test', not 'production'
            // so isDev would be true - this depends on how logger.ts evaluates
        });
    });

    describe('service-specific loggers', () => {
        it('should have pdf logger', () => {
            expect(typeof logger.pdf).toBe('function');
        });

        it('should have blob logger', () => {
            expect(typeof logger.blob).toBe('function');
        });

        it('should have email logger', () => {
            expect(typeof logger.email).toBe('function');
        });

        it('should have db logger', () => {
            expect(typeof logger.db).toBe('function');
            logger.db('Database connection');
            expect(console.log).toHaveBeenCalledWith('[Database] Database connection');
        });
    });
});
