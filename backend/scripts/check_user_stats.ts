import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
    try {
        const users = await prisma.user.findMany();
        console.log('--- USERS ---');
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Email: ${u.email}`);
        });

        // Check if requirements are linked to these users
        const reqs = await prisma.requirement.findMany({
            select: { id: true, createdById: true, title: true }
        });

        console.log('--- REQ SAMPLE ---');
        reqs.slice(0, 5).forEach(r => {
            console.log(`Req: ${r.title}, CreatedBy: ${r.createdById}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
