
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const keepId = '677b242d-ac40-400b-96c5-5aa82a614690';
    const deleteId = 'c53b998c-291b-4b8d-b623-01b3e65a96d0';

    console.log(`Keeping master: ${keepId}`);
    console.log(`Deleting duplicate: ${deleteId}`);

    // Since we verified counts are 0, we can dry run relations just in case
    // Move relations if any (Hypothetical, script logic good for future reuse)
    await prisma.requirement.updateMany({
        where: { supplierId: deleteId },
        data: { supplierId: keepId }
    });

    await prisma.invoice.updateMany({
        where: { supplierId: deleteId },
        data: { supplierId: keepId }
    });

    await prisma.supplier.delete({
        where: { id: deleteId }
    });

    console.log("Merge completed successfully.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
