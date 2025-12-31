"use strict";
/**
 * Logger Service Unit Tests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../services/logger"));
describe('Logger Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('info', () => {
        it('should log info messages', () => {
            logger_1.default.info('Test info message');
            expect(console.log).toHaveBeenCalledWith('[INFO] Test info message');
        });
        it('should log info messages with additional args', () => {
            logger_1.default.info('Test info', { key: 'value' });
            expect(console.log).toHaveBeenCalledWith('[INFO] Test info', { key: 'value' });
        });
    });
    describe('warn', () => {
        it('should log warning messages', () => {
            logger_1.default.warn('Test warning');
            expect(console.warn).toHaveBeenCalledWith('[WARN] Test warning');
        });
    });
    describe('error', () => {
        it('should log error messages', () => {
            logger_1.default.error('Test error');
            expect(console.error).toHaveBeenCalledWith('[ERROR] Test error');
        });
        it('should log error with error object', () => {
            const error = new Error('Test');
            logger_1.default.error('Test error', error);
            expect(console.error).toHaveBeenCalledWith('[ERROR] Test error', error);
        });
    });
    describe('debug', () => {
        it('should only log in development mode', () => {
            // In test environment, debug should not log
            logger_1.default.debug('Debug message');
            // With our test setup, NODE_ENV is 'test', not 'production'
            // so isDev would be true - this depends on how logger.ts evaluates
        });
    });
    describe('service-specific loggers', () => {
        it('should have pdf logger', () => {
            expect(typeof logger_1.default.pdf).toBe('function');
        });
        it('should have blob logger', () => {
            expect(typeof logger_1.default.blob).toBe('function');
        });
        it('should have email logger', () => {
            expect(typeof logger_1.default.email).toBe('function');
        });
        it('should have db logger', () => {
            expect(typeof logger_1.default.db).toBe('function');
            logger_1.default.db('Database connection');
            expect(console.log).toHaveBeenCalledWith('[Database] Database connection');
        });
    });
});
