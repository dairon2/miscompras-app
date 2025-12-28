import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const suppliers = await prisma.supplier.findMany();
    console.log('Suppliers:', JSON.stringify(suppliers, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
