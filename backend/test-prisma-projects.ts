
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Testing Project Connection...');
    try {
        const projects = await prisma.project.findMany({
            include: {
                leader: { select: { id: true, name: true } }
            }
        });
        console.log('Successfully fetched projects:', projects.length);
        console.log('Sample project:', projects[0]);
    } catch (error) {
        console.error('Error fetching projects:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
