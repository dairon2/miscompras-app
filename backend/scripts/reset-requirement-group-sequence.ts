/**
 * Script para reiniciar la secuencia del RequirementGroup
 * Esto hace que el próximo groupId sea 7 en lugar de continuar desde 52+
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetRequirementGroupSequence() {
    try {
        console.log('🔍 Verificando estado actual de RequirementGroup...\n');

        // Obtener todos los grupos existentes
        const groups = await prisma.requirementGroup.findMany({
            orderBy: { id: 'asc' },
            include: {
                _count: {
                    select: { requirements: true }
                }
            }
        });

        console.log(`📊 Total de grupos existentes: ${groups.length}`);

        if (groups.length > 0) {
            console.log('\nGrupos actuales:');
            groups.forEach(g => {
                console.log(`  - ID: ${g.id}, Requerimientos: ${g._count.requirements}, Creado: ${g.createdAt.toISOString().split('T')[0]}`);
            });

            const maxId = Math.max(...groups.map(g => g.id));
            console.log(`\n📌 ID máximo actual: ${maxId}`);
        }

        // Determinar el nuevo valor de inicio de la secuencia
        // Será el máximo ID existente + 1, o 7 si el máximo es menor que 6
        const currentMaxId = groups.length > 0 ? Math.max(...groups.map(g => g.id)) : 0;
        const newSequenceValue = Math.max(currentMaxId + 1, 7);

        console.log(`\n🔧 Reiniciando secuencia a: ${newSequenceValue}`);

        // Ejecutar el comando SQL para reiniciar la secuencia
        // En PostgreSQL, la secuencia se llama "RequirementGroup_id_seq"
        await prisma.$executeRawUnsafe(
            `ALTER SEQUENCE "RequirementGroup_id_seq" RESTART WITH ${newSequenceValue}`
        );

        console.log('✅ Secuencia reiniciada exitosamente!\n');

        // Verificar que la secuencia se reinició correctamente
        const sequenceInfo = await prisma.$queryRaw<{ last_value: bigint }[]>`
      SELECT last_value FROM "RequirementGroup_id_seq"
    `;

        console.log(`📋 Nuevo valor de la secuencia: ${sequenceInfo[0]?.last_value}`);
        console.log('\n🎉 El próximo grupo de requerimientos tendrá el ID:', newSequenceValue);

    } catch (error) {
        console.error('❌ Error al reiniciar la secuencia:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

resetRequirementGroupSequence()
    .then(() => {
        console.log('\n✨ Proceso completado.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
