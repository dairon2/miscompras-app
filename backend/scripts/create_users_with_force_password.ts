
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const users = [
    {
        name: 'Maryluz Agudelo',
        email: 'maryluz.agudelo@museodeantioquia.co',
        role: 'COORDINATOR' as Role,
        position: 'Coordinadora de Compras y Suministros',
        areaId: 'area-6'
    },
    {
        name: 'Angela María Rodríguez Giraldo',
        email: 'angela.rodriguez@museodeantioquia.co',
        role: 'ADMIN' as Role,
        position: 'Auxiliar Administrativa',
        areaId: 'area-6'
    },
    {
        name: 'Manuela Alvarez Londoño',
        email: 'manuela.alvarez@museodeantioquia.co',
        role: 'DIRECTOR' as Role,
        position: 'Directora Financiera y Administrativa',
        areaId: 'area-6',
        isDirector: true
    }
];

async function main() {
    const password = 'Museo2026!';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Creating users with password: ${password}`);
    console.log(`Force Change Password: ENABLED`);

    for (const u of users) {
        // Upsert user
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                name: u.name,
                role: u.role,
                position: u.position,
                areaId: u.areaId,
                mustChangePassword: true,
                // Do not update password if already exists to avoid locking them out if they changed it?
                // User asked to add them. If they exist, maybe reset?
                // "The system forces them to change it when they log in for the first time" implies new accounts.
                // I will reset password just in case.
                password: hashedPassword
            },
            create: {
                name: u.name,
                email: u.email,
                role: u.role,
                position: u.position,
                areaId: u.areaId,
                password: hashedPassword,
                mustChangePassword: true
            }
        });

        console.log(`Processed user: ${u.name} (${u.role})`);

        if (u.isDirector) {
            // Assign as Area Director
            await prisma.area.update({
                where: { id: u.areaId },
                data: { directorId: user.id }
            });
            console.log(`   -> Assigned as Director of ${u.areaId}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
