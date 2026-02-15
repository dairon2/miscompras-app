import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    // Find a requirement with a budgetId
    const requirement = await prisma.requirement.findFirst({
        where: { budgetId: { not: null } },
        include: {
            budget: {
                include: {
                    category: true
                }
            },
            project: true
        }
    });

    if (requirement) {
        console.log('=== Requirement Found ===');
        console.log('ID:', requirement.id);
        console.log('Title:', requirement.title);
        console.log('Project:', requirement.project?.name);
        console.log('BudgetId:', requirement.budgetId);
        console.log('Budget:', requirement.budget ? JSON.stringify(requirement.budget, null, 2) : 'NULL');
    } else {
        console.log('No requirements with budgetId found');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
