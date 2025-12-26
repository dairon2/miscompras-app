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
    const proj1 = await prisma.project.create({
        data: { name: 'Exposición Fernando Botero 2024', budget: 50000000 }
    });

    // 3. Create Suppliers
    const supp1 = await prisma.supplier.create({
        data: { name: 'Papelería El Cid', contact: 'Juan Perez', email: 'ventas@elcid.com' }
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
