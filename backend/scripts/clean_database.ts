import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
    console.log('🧹 Iniciando limpieza de base de datos...\n');

    try {
        // Orden de eliminación respetando restricciones de clave foránea
        // Primero los registros hijos, luego los padres

        // 1. Pagos de facturas
        const payments = await prisma.invoicePayment.deleteMany();
        console.log(`✅ InvoicePayment: ${payments.count} registros eliminados`);

        // 2. Facturas
        const invoices = await prisma.invoice.deleteMany();
        console.log(`✅ Invoice: ${invoices.count} registros eliminados`);

        // 3. Adjuntos de requerimientos
        const attachments = await prisma.attachment.deleteMany();
        console.log(`✅ Attachment: ${attachments.count} registros eliminados`);

        // 4. Registros contables (Asientos)
        const journalEntries = await prisma.journalEntry.deleteMany();
        console.log(`✅ JournalEntry: ${journalEntries.count} registros eliminados`);

        // 5. Requerimientos
        const requirements = await prisma.requirement.deleteMany();
        console.log(`✅ Requirement: ${requirements.count} registros eliminados`);

        // 6. Grupos de requerimientos
        const reqGroups = await prisma.requirementGroup.deleteMany();
        console.log(`✅ RequirementGroup: ${reqGroups.count} registros eliminados`);

        // 7. Sublíderes de presupuesto
        const subLeaders = await prisma.budgetSubLeader.deleteMany();
        console.log(`✅ BudgetSubLeader: ${subLeaders.count} registros eliminados`);

        // 8. Ajustes presupuestales
        const adjustments = await prisma.budgetAdjustment.deleteMany();
        console.log(`✅ BudgetAdjustment: ${adjustments.count} registros eliminados`);

        // 9. Presupuestos
        const budgets = await prisma.budget.deleteMany();
        console.log(`✅ Budget: ${budgets.count} registros eliminados`);

        // 10. Notificaciones
        const notifications = await prisma.notification.deleteMany();
        console.log(`✅ Notification: ${notifications.count} registros eliminados`);

        console.log('\n✨ Limpieza completada exitosamente!');
        console.log('\n📋 Datos PRESERVADOS:');

        const users = await prisma.user.count();
        const areas = await prisma.area.count();
        const projects = await prisma.project.count();
        const categories = await prisma.category.count();
        const suppliers = await prisma.supplier.count();

        console.log(`   - Users: ${users}`);
        console.log(`   - Areas: ${areas}`);
        console.log(`   - Projects: ${projects}`);
        console.log(`   - Categories: ${categories}`);
        console.log(`   - Suppliers: ${suppliers}`);

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDatabase();
