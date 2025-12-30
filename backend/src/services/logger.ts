/**
 * Logger Service - Configurable logging for production and development
 * Only shows debug logs in development mode
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
    info: (message: string, ...args: any[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },

    warn: (message: string, ...args: any[]) => {
        console.warn(`[WARN] ${message}`, ...args);
    },

    error: (message: string, ...args: any[]) => {
        console.error(`[ERROR] ${message}`, ...args);
    },

    debug: (message: string, ...args: any[]) => {
        if (isDev) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },

    // Service-specific loggers
    pdf: (message: string, ...args: any[]) => {
        if (isDev) {
            console.log(`[PDF Service] ${message}`, ...args);
        }
    },

    blob: (message: string, ...args: any[]) => {
        if (isDev) {
            console.log(`[Blob Storage] ${message}`, ...args);
        }
    },

    email: (message: string, ...args: any[]) => {
        if (isDev) {
            console.log(`[Email Service] ${message}`, ...args);
        }
    },

    db: (message: string, ...args: any[]) => {
        console.log(`[Database] ${message}`, ...args);
    }
};

export default logger;
