"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const demoData_1 = require("./demoData");
// Database Initialization
let prisma;
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    console.log('--- PRODUCTION MODE: Connecting to Database ---');
    exports.prisma = prisma = new client_1.PrismaClient({
        log: ['error', 'warn'],
    });
    // Test connection
    prisma.$connect()
        .then(() => console.log('Successfully connected to Azure PostgreSQL'))
        .catch((e) => {
        console.error('DATABASE CONNECTION ERROR:', e.message);
        console.error('Check your DATABASE_URL and Azure Firewall rules.');
    });
}
else {
    console.log('--- DEMO MODE: Database disabled (using prismaMock) ---');
    exports.prisma = prisma = demoData_1.prismaMock;
}
