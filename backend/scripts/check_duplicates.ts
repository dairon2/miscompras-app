
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const suppliers = await prisma.supplier.findMany({
        select: { name: true, nit: true, id: true }
    });

    const nameMap = new Map<string, any[]>();
    const nitMap = new Map<string, any[]>();

    suppliers.forEach(s => {
        // Normalize name: lowercase, trim
        const normName = s.name.toLowerCase().trim();
        if (!nameMap.has(normName)) nameMap.set(normName, []);
        nameMap.get(normName)?.push(s);

        if (s.nit) {
            const normNit = s.nit.trim();
            if (!nitMap.has(normNit)) nitMap.set(normNit, []);
            nitMap.get(normNit)?.push(s);
        }
    });

    console.log("--- Duplicate Names Analysis ---");
    let duplicateNamesCount = 0;
    nameMap.forEach((list, name) => {
        if (list.length > 1) {
            console.log(`Name: "${name}" appears ${list.length} times.`);
            list.forEach(s => console.log(`   - ID: ${s.id}, NIT: ${s.nit || 'N/A'}`));
            duplicateNamesCount++;
        }
    });

    if (duplicateNamesCount === 0) console.log("No duplicate names found.");

    console.log("\n--- Duplicate NITs Analysis (Should be 0 due to unique constraint) ---");
    nitMap.forEach((list, nit) => {
        if (list.length > 1) {
            console.log(`NIT: "${nit}" appears ${list.length} times.`);
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
