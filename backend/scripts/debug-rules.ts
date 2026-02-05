
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRules() {
    console.log('--- Active Submission Rules ---');
    const rules = await prisma.submissionRule.findMany({
        where: { isActive: true }
    });
    console.log(JSON.stringify(rules, null, 2));
}

checkRules().catch(console.error).finally(() => prisma.$disconnect());
