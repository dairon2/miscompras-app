
import { PrismaClient } from '@prisma/client';
import { prismaMock } from './demoData';

// Database Initialization
let prisma: PrismaClient;
const isProduction = process.env.NODE_ENV === 'production';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    console.log('--- PRODUCTION MODE: Connecting to Database ---');
    prisma = new PrismaClient({
        log: ['error', 'warn'],
    });
    // Test connection
    prisma.$connect()
        .then(() => console.log('Successfully connected to Azure PostgreSQL'))
        .catch((e) => {
            console.error('DATABASE CONNECTION ERROR:', e.message);
            console.error('Check your DATABASE_URL and Azure Firewall rules.');
            if (isProduction) {
                console.error('Production database connection failed. Exiting to avoid serving mock data.');
                process.exit(1);
            }
            console.log('--- FALLBACK: Switching to DEMO MODE automatically ---');
            prisma = prismaMock as any;
        });
} else {
    if (isProduction) {
        console.error('DATABASE_URL is missing or points to mock data in production. Exiting.');
        process.exit(1);
    }
    console.log('--- DEMO MODE: Database disabled (using prismaMock) ---');
    prisma = prismaMock as any;
}

export { prisma };
