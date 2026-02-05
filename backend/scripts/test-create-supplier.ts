
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting supplier creation test...');

    // Generate a unique NIT to avoid collision
    const randomNit = `900${Math.floor(Math.random() * 1000000)}`;
    const randomName = `Test Supplier ${Math.floor(Math.random() * 1000)}`;

    console.log(`Attempting to create supplier with NIT: ${randomNit} and Name: ${randomName}`);

    try {
        const supplier = await prisma.supplier.create({
            data: {
                name: randomName,
                nit: randomNit,
                contactName: "Test Contact",
                email: "test@example.com",
                phone: "1234567890",
                address: "Calle 123",
                activity: "Testing",
                supplierType: "SUPPLIER",
                criticality: "LOW"
            }
        });

        console.log('Supplier created successfully:');
        console.log(JSON.stringify(supplier, null, 2));

        // Cleanup
        console.log('Cleaning up (deleting created supplier)...');
        await prisma.supplier.delete({ where: { id: supplier.id } });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Error creating supplier:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
