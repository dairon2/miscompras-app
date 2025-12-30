/**
 * Jest Test Setup File
 * Configures mocks and global test utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'mock://test';

// Increase timeout for async tests
jest.setTimeout(10000);

// Mock console.log/error to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};
