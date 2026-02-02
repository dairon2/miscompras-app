import { PrismaClient } from '@prisma/client';

async function checkData() {
    const prisma = new PrismaClient();
    try {
        const users = await prisma.user.count();
        const reqs = await prisma.requirement.count();
        const budgets = await prisma.budget.count();
        console.log(`Users: ${users}, Requirements: ${reqs}, Budgets: ${budgets}`);
    } finally {
        await prisma.$disconnect();
    }
}
checkData();
