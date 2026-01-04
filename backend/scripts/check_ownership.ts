import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOwnership() {
    try {
        const users = await prisma.user.findMany();
        const dairon = users.find(u => u.name.includes('Dairon') || u.email.includes('dairon'));

        if (dairon) {
            console.log(`User Dairon: ID=${dairon.id}, Role=${dairon.role}, Email=${dairon.email}`);
        } else {
            console.log('User Dairon not found');
        }

        const recent = await prisma.requirement.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { createdBy: true }
        });

        console.log('--- RECENT REQUIREMENTS ---');
        recent.forEach(r => {
            console.log(`ID: ${r.id}, Title: ${r.title}, GroupId: ${r.groupId}, CreatedBy: ${r.createdBy?.name} (${r.createdById})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkOwnership();
