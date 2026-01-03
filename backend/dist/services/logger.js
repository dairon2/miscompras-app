"use strict";
/**
 * Logger Service - Configurable logging for production and development
 * Only shows debug logs in development mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
    info: (message, ...args) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (isDev) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
    // Service-specific loggers
    pdf: (message, ...args) => {
        console.log(`[PDF Service] ${message}`, ...args);
    },
    blob: (message, ...args) => {
        console.log(`[Blob Storage] ${message}`, ...args);
    },
    email: (message, ...args) => {
        console.log(`[Email Service] ${message}`, ...args);
    },
    db: (message, ...args) => {
        console.log(`[Database] ${message}`, ...args);
    }
};
exports.default = logger;
