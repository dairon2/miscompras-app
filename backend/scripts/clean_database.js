const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDatabase() {
    console.log('🧹 Iniciando limpieza de base de datos...\n');

    const tablesToClean = [
        'InvoicePayment',
        'Invoice',
        'Attachment',
        'JournalEntry',
        'Requirement',
        'RequirementGroup',
        'BudgetSubLeader',
        'BudgetAdjustment',
        'Budget',
        'Notification'
    ];

    for (const table of tablesToClean) {
        try {
            const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
            console.log(`✅ ${table}: ${result} registros eliminados`);
        } catch (error) {
            if (error.code === 'P2010' && error.meta?.code === '42P01') {
                console.log(`⏭️  ${table}: tabla no existe, saltando...`);
            } else {
                console.log(`⚠️  ${table}: ${error.message}`);
            }
        }
    }

    console.log('\n✨ Limpieza completada!');
    console.log('\n📋 Datos PRESERVADOS: Users, Areas, Projects, Categories, Suppliers');

    await prisma.$disconnect();
}

cleanDatabase();
