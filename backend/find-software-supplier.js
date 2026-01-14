const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const suppliers = await prisma.supplier.findMany({
        where: {
            OR: [
                { activity: { contains: 'software', mode: 'insensitive' } },
                { activity: { contains: 'desarrollo', mode: 'insensitive' } },
                { activity: { contains: 'tecnolog', mode: 'insensitive' } },
                { activity: { contains: 'sistema', mode: 'insensitive' } },
                { activity: { contains: 'plataforma', mode: 'insensitive' } }
            ]
        },
        select: { name: true, activity: true, contactEmail: true }
    });

    console.log('\n📋 PROVEEDORES DE SOFTWARE/TECNOLOGÍA:\n');
    if (suppliers.length === 0) {
        console.log('❌ No se encontraron proveedores con actividad relacionada a software.');
        console.log('\n📝 Tip: Registra la "Actividad Económica" de cada proveedor para que el sistema pueda buscarlos.');
    } else {
        suppliers.forEach(s => {
            console.log(`✅ ${s.name}`);
            console.log(`   📝 Actividad: ${s.activity || 'Sin especificar'}`);
            console.log(`   📧 Email: ${s.contactEmail || 'N/A'}\n`);
        });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
