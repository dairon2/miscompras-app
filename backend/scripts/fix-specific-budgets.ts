import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Corrigiendo los dos presupuestos con valores desfasados...");

    const budgetsToFix = [
        {
            id: "22726cf5-bed4-4ea0-84f6-f989c90b5e32",
            name: "Hosting cloud",
            expectedAvailable: 1227418
        },
        {
            id: "6a7e1511-b01a-4e91-9569-72b080d15b1c",
            name: "Aire acondicionado preventivo y posibles correctivos",
            expectedAvailable: 79190287
        }
    ];

    for (const budget of budgetsToFix) {
        console.log(`\nActualizando presupuesto: ${budget.name} (ID: ${budget.id})`);
        console.log(`Nuevo saldo disponible (esperado): $${budget.expectedAvailable}`);

        await prisma.budget.update({
            where: { id: budget.id },
            data: {
                available: budget.expectedAvailable
            }
        });

        console.log(`✅ Presupuesto "${budget.name}" corregido exitosamente.`);
    }

    console.log("\n¡Corrección finalizada!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
