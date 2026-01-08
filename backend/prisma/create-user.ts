import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Get first area
    const area = await prisma.area.findFirst();
    if (!area) {
        console.error('No areas found. Please run seed first.');
        return;
    }

    const hashedPassword = await bcrypt.hash('dairon2024', 10);

    const user = await prisma.user.upsert({
        where: { email: 'daironmoreno24@gmail.com' },
        update: {},
        create: {
            email: 'daironmoreno24@gmail.com',
            password: hashedPassword,
            name: 'Dairon Moreno',
            role: 'DIRECTOR',
            areaId: area.id
        }
    });

    console.log('Usuario creado:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
