
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing getRequirementGroups logic...');

    try {
        const where: any = {
            status: 'PENDING_APPROVAL'
        };

        console.log('Querying requirements with:', where);

        const requirements = await prisma.requirement.findMany({
            where,
            include: {
                project: true,
                area: true,
                budget: {
                    include: {
                        category: true
                    }
                },
                attachments: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${requirements.length} requirements.`);
        if (requirements.length > 0) {
            console.log('Sample req:', JSON.stringify(requirements[0], null, 2));
        }

        // Simulate transformation
        const groupedData = [{
            id: 1,
            creator: requirements[0]?.createdBy || { id: '', name: 'Sistema', email: '' },
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            requirements: requirements
        }];

        console.log('Grouped Data created successfully.');

    } catch (error) {
        console.error('ERROR executing query:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
