import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    // Use specific requirement ID from screenshot
    const reqId = 'af64cc31-c147-43e9-a2db-c740338a3d88';

    console.log('Testing getRequirementById query for:', reqId);

    const requirement = await prisma.requirement.findUnique({
        where: { id: reqId },
        include: {
            project: true,
            area: true,
            supplier: true,
            createdBy: true,
            attachments: true,
            logs: {
                orderBy: { createdAt: 'desc' }
            },
            group: true,
            budget: {
                include: {
                    category: true
                }
            }
        }
    });

    if (requirement) {
        console.log('=== Requirement Found ===');
        console.log('ID:', requirement.id);
        console.log('Title:', requirement.title);
        console.log('BudgetId:', requirement.budgetId);
        console.log('Budget object:', requirement.budget ? JSON.stringify(requirement.budget, null, 2) : 'NULL/UNDEFINED');
    } else {
        console.log('Requirement not found');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
