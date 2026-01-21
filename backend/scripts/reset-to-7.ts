/**
 * Reinicia la secuencia de RequirementGroup a 7
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Verificar estado actual
    const groups = await prisma.requirementGroup.findMany({
        orderBy: { id: 'asc' },
        select: { id: true }
    });

    console.log('Grupos actuales:', groups.map(g => g.id));
    console.log('Total:', groups.length);

    const maxId = groups.length > 0 ? Math.max(...groups.map(g => g.id)) : 0;
    console.log('ID máximo:', maxId);

    // Reiniciar secuencia a 7
    await prisma.$executeRawUnsafe(
        `ALTER SEQUENCE "RequirementGroup_id_seq" RESTART WITH 7`
    );

    console.log('✅ Secuencia reiniciada a: 7');
    console.log('🎉 El próximo grupo de requerimientos tendrá el ID #7');

    await prisma.$disconnect();
}

main();
