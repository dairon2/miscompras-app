import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Buscando presupuestos con discrepancias en sus montos y requerimientos asignados...");

    const budgets = await prisma.budget.findMany({
        include: {
            requirements: true
        }
    });

    const mismatches = [];

    for (const budget of budgets) {
        let totalExecuted = 0;

        for (const req of budget.requirements) {
            const amountToDeduct = req.actualAmount
                ? parseFloat(req.actualAmount.toString())
                : (req.totalAmount ? parseFloat(req.totalAmount.toString()) : 0);

            // Si el requerimiento no estรก rechazado o anulado. OJO: A veces los rechazados retuvieron su saldo, pero sumemos todos primero para comparar la logica de DB actual.
            totalExecuted += amountToDeduct;
        }

        const expectedAvailable = parseFloat(budget.amount.toString()) - totalExecuted;
        const currentAvailable = parseFloat(budget.available.toString());
        const discrepancy = currentAvailable - expectedAvailable;

        if (Math.abs(discrepancy) > 0.01) {
            mismatches.push({
                Id: budget.id,
                Titulo: budget.title,
                Asignado: parseFloat(budget.amount.toString()),
                SumaRequerimientos: totalExecuted,
                EjecutadoRealApp: parseFloat(budget.amount.toString()) - currentAvailable,
                DisponibleApp: currentAvailable,
                DisponibleEsperado: expectedAvailable,
                Diferencia: discrepancy
            });
        }
    }

    if (mismatches.length > 0) {
        console.log(`\n¡Se encontraron ${mismatches.length} presupuestos con cálculos incorrectos!\n`);
        console.log(JSON.stringify(mismatches, null, 2));
    } else {
        console.log("\n✅ Todos los presupuestos tienen los saldos matemáticamente correctos con respecto a sus requerimientos actuales.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
