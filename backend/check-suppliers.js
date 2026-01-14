const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    console.log('\n=== Buscando "Dairon" ===');
    const dairon = await p.supplier.findMany({
        where: { name: { contains: 'Dairon', mode: 'insensitive' } },
        select: { name: true, activity: true }
    });
    console.log(dairon.length ? dairon : 'No encontrado');

    console.log('\n=== Buscando "software" en actividad ===');
    const software = await p.supplier.findMany({
        where: { activity: { contains: 'software', mode: 'insensitive' } },
        select: { name: true, activity: true }
    });
    console.log(software.length ? software : 'No encontrado');

    console.log('\n=== Buscando "Siigo" ===');
    const siigo = await p.supplier.findMany({
        where: { name: { contains: 'Siigo', mode: 'insensitive' } },
        select: { name: true, activity: true }
    });
    console.log(siigo.length ? siigo : 'No encontrado');
}

main().finally(() => p.$disconnect());
