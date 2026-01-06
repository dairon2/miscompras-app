
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const ids = [
        '677b242d-ac40-400b-96c5-5aa82a614690',
        'c53b998c-291b-4b8d-b623-01b3e65a96d0'
    ];

    const suppliers = await prisma.supplier.findMany({
        where: { id: { in: ids } },
        include: {
            _count: {
                select: { requirements: true, invoices: true }
            }
        }
    });

    console.log(JSON.stringify(suppliers, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
