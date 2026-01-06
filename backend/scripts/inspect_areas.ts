
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const areas = await prisma.area.findMany();
    console.log("Existing Areas:");
    areas.forEach(a => console.log(`- ${a.name} (ID: ${a.id})`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
