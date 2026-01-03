
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting verification...');

    // 1. Create Data (Project, Area, Category)
    const project = await prisma.project.create({
        data: {
            name: 'Project verify dup',
            code: 'PROJ-VERIFY-' + Date.now(),
        }
    });

    const area = await prisma.area.create({
        data: {
            name: 'Area verify dup ' + Date.now(),
        }
    });

    // 2. Create First Budget
    const code = 'DUP-TEST-' + Date.now();
    const budget1 = await prisma.budget.create({
        data: {
            title: 'Budget 1',
            code: code,
            amount: 1000,
            available: 1000,
            projectId: project.id,
            areaId: area.id,
            year: 2025
        }
    });
    console.log('Created Budget 1:', budget1.code);

    // 3. Create Second Budget with SAME CODE
    try {
        const budget2 = await prisma.budget.create({
            data: {
                title: 'Budget 2',
                code: code, // SAME CODE
                amount: 2000,
                available: 2000,
                projectId: project.id,
                areaId: area.id,
                year: 2025
            }
        });
        console.log('Created Budget 2:', budget2.code);

        if (budget1.code === budget2.code) {
            console.log('SUCCESS: Both budgets have the same code.');
        } else {
            console.error('FAILURE: Codes do not match?');
        }

    } catch (error) {
        console.error('FAILURE: Could not create duplicate budget.', error);
    } finally {
        // Cleanup
        await prisma.budget.deleteMany({ where: { code: code } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.area.delete({ where: { id: area.id } });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
