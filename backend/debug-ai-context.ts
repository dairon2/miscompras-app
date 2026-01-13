
// @ts-nocheck
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- DEBUGGING AI CONTEXT DATA ---");

    try {
        const userId = 'DEBUG_USER_ID'; // We verify generic admin/global view first
        const userRole = 'ADMIN';

        const [projects, budgets, reqsPending] = await Promise.all([
            prisma.project.findMany({
                take: 10,
                orderBy: { updatedAt: 'desc' },
                select: { name: true, code: true }
            }),
            prisma.budget.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: { title: true, available: true, project: { select: { name: true } } }
            }),
            prisma.requirement.findMany({
                where: { status: 'PENDING_APPROVAL' },
                take: 10,
                select: { title: true, createdBy: { select: { email: true } }, estimatedAmount: true }
            })
        ]);

        const projectsCount = await prisma.project.count();

        console.log(`Projects found: ${projects.length} (Total Count: ${projectsCount})`);
        console.log("Projects Data:", JSON.stringify(projects, null, 2));

        const contextData = `
            DATOS GENERALES DEL SISTEMA (Rol: ${userRole}):
            
            PROYECTOS RECIENTES (Total: ${projectsCount}):
            ${projects.map(p => `- ${p.name} (${p.code})`).join('\n')}
            
            PRESUPUESTOS RECIENTES...
            ${budgets.map(b => `- ${b.title}: $${b.available}`).join('\n')}
        `;

        console.log("\n--- GENERATED CONTEXT STRING ---");
        console.log(contextData);
        console.log("--------------------------------");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
