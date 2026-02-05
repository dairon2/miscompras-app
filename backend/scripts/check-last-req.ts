
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLastRequirement() {
    const lastReq = await prisma.requirement.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { createdBy: true }
    });

    if (lastReq) {
        console.log('--- Last Requirement ---');
        console.log(`ID: ${lastReq.id}`);
        console.log(`Title: ${lastReq.title}`);
        console.log(`Created At: ${lastReq.createdAt.toISOString()}`);
        console.log(`Created By: ${lastReq.createdBy.name} (${lastReq.createdBy.email})`);
        console.log(`Role: ${lastReq.createdBy.role}`);
    } else {
        console.log('No requirements found.');
    }
}

checkLastRequirement().catch(console.error).finally(() => prisma.$disconnect());
