/**
 * Script para verificar y reiniciar la secuencia del RequirementGroup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Ver grupos existentes
    const groups = await prisma.requirementGroup.findMany({
        orderBy: { id: 'asc' },
        select: { id: true }
    });

    console.log('Grupos existentes:', groups.map(g => g.id));
    console.log('Total:', groups.length);

    if (groups.length > 0) {
        const maxId = Math.max(...groups.map(g => g.id));
        console.log('ID máximo:', maxId);

        // Reiniciar secuencia al máximo + 1 pero mínimo 7
        const newValue = Math.max(maxId + 1, 7);
        console.log('Nuevo valor de secuencia:', newValue);

        await prisma.$executeRawUnsafe(
            `ALTER SEQUENCE "RequirementGroup_id_seq" RESTART WITH ${newValue}`
        );
        console.log('Secuencia reiniciada a:', newValue);
    } else {
        // Si no hay grupos, empezar desde 7
        await prisma.$executeRawUnsafe(
            `ALTER SEQUENCE "RequirementGroup_id_seq" RESTART WITH 7`
        );
        console.log('Secuencia reiniciada a: 7');
    }

    await prisma.$disconnect();
}

main();
