import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Create Areas
    const admArea = await prisma.area.upsert({
        where: { name: 'Administrativa' },
        update: {},
        create: { name: 'Administrativa' }
    });

    const curArea = await prisma.area.upsert({
        where: { name: 'Curaduría' },
        update: {},
        create: { name: 'Curaduría' }
    });

    // 2. Create Projects
    // 2. Create Projects
    const proj1 = await prisma.project.upsert({
        where: { code: 'P-BOTERO-2024' },
        update: {},
        create: {
            name: 'Exposición Fernando Botero 2024',
            code: 'P-BOTERO-2024',
            description: 'Proyecto de exposición temporal'
        }
    });

    // 3. Create Suppliers
    // 3. Create Suppliers
    const supp1 = await prisma.supplier.upsert({
        where: { taxId: '900123456-7' },
        update: {},
        create: {
            name: 'Papelería El Cid',
            taxId: '900123456-7',
            contactEmail: 'ventas@elcid.com'
        }
    });

    // 4. Create Admin User
    await prisma.user.upsert({
        where: { email: 'admin@museodeantioquia.co' },
        update: {},
        create: {
            email: 'admin@museodeantioquia.co',
            password: hashedPassword,
            name: 'Administrador Museo',
            role: 'ADMIN',
            areaId: admArea.id
        }
    });

    console.log('Seed completed successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
