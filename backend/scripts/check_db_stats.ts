import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStats() {
    try {
        const reqCount = await prisma.requirement.count();
        const budgetCount = await prisma.budget.count();
        const invoiceCount = await prisma.invoice.count();
        const userCount = await prisma.user.count();

        console.log('--- DB STATS ---');
        console.log(`Users: ${userCount}`);
        console.log(`Requirements: ${reqCount}`);
        console.log(`Budgets: ${budgetCount}`);
        console.log(`Invoices: ${invoiceCount}`);

        const recent = await prisma.requirement.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, createdAt: true, year: true }
        });
        console.log('Recent Requirements:', recent);

    } catch (error) {
        console.error('Error connecting to DB:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkStats();
