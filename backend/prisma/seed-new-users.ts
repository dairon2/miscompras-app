import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Contraseña temporal para todos los usuarios nuevos
const TEMP_PASSWORD = 'Museo2026*';

const newUsers = [
    { name: "Andrea Peña Angel", email: "andrea.pena@museodeantioquio.co", area: "Educación", position: "Técnico Administrativa" },
    { name: "Bibiana Andrea López Arango", email: "bibiana.lopez@museodeantioquia.co", area: "Administrativa", position: "Auxiliar de Gestión Humana" },
    { name: "Catalina Giraldo Durango", email: "catalina.giraldo@museodeantioquia.co", area: "Juridica", position: "Técnico Juridica" },
    { name: "Cristina Abad Londoño", email: "cristina.abad@museodeantioquia.co", area: "Juridica", position: "Directora de Jurídica" },
    { name: "Doris Helena Tobón Moreno", email: "doris.tobon@museodeantioquia.co", area: "Dirección", position: "Secretaria Dirección General" },
    { name: "Elizabeth Cristina Muñoz Saldarriaga", email: "elizabeth.munoz@museodeantioquia.co", area: "Administrativa", position: "Coordinadora de Gestión Humana" },
    { name: "Johan Felipe Gómez Torres", email: "felipe.gomez@musendeantioquio.co", area: "Producción y Logística", position: "Coordinador de Operaciones" },
    { name: "Juan Camilo Castaño Uribe", email: "juan.castano@museodeantioquia.co", area: "Curaduría", position: "Curador Asistente" },
    { name: "Juan Guillermo Bustamante", email: "juan.bustamante@museodeantioquia.co", area: "Producción y Logística", position: "Director de Producción y Logística" },
    { name: "Juli Zapata Rincón", email: "julian.zapata@museodeantioquia.co", area: "Curaduría", position: "Curador Asistente" },
    { name: "Lida Elena Restrepo Henao", email: "lida.restrepod@museodeantioquia.co", area: "Dirección", position: "Líder Públicos" },
    { name: "Mantenimiento Operaciones", email: "mantenimiento@museodeantioquia.co", area: "Producción y Logística", position: "Mantenimiento Operaciones" },
    { name: "Maria del Rosario Escobar", email: "rosario.escobar@museodeantioquia.co", area: "Dirección", position: "Directora General Museo de Antioquia" },
    { name: "Mónica Maria Arbeláez Flórez", email: "monica.arbelaez@museodeantioquia.co", area: "Dirección", position: "Líder Control Interno" },
    { name: "Zoranny Areliz Restrepo Henao", email: "zoranny.restrepo@museodeantioquia.co", area: "Curaduría", position: "Supervisor de Diseño y Museografía" },
    { name: "Sebastian Moreno Agudelo", email: "sebastian.moreno@museodeantioquia.co", area: "Educación", position: "Mediador" },
    { name: "Said Fernando Cardoza Duarte", email: "fernando.cardoza@museodeantioquia.co", area: "Producción y Logística", position: "Coordinador de Sistemas" },
    { name: "Nathaly Janice Solano Hoyos", email: "nathaly.solano@museodeantioquia.co", area: "Proyectos", position: "Directora de Proyectos" },
    { name: "Johanna Alejandra Diosa Gonzalez", email: "johanna.diosa@museodeantioquia.co", area: "Proyectos", position: "" },
    { name: "Candy Montoya Palacios", email: "candy.montoya@museodeantioquia.co", area: "Comunicaciones", position: "Técnico admin comunicaciones" },
    { name: "Diana Maria Ramirez Sierra", email: "diana.ramirez@museodeantioquia.co", area: "Comunicaciones", position: "Directora de Comunicaciones" },
    { name: "Cindy Cano", email: "cindy.cano@museodeantioquia.co", area: "Administrativa", position: "Auxiliar Administrativa" },
    { name: "Juan David Lopera Mazo", email: "juan.lopera@museodeantioquia.co", area: "Educación", position: "" },
    { name: "Vanessa Acosta Ramirez", email: "vanessa.acosta@museodeantioquia.co", area: "Educación", position: "Direccion Educacion" },
    { name: "Maira Lizette Gil Valencia", email: "maira.gil@museodeantioquia.co", area: "Proyectos", position: "" },
    { name: "Yeisson Alberto Colmenares Torres", email: "yeisson.colmenares@museodeantioquia.co", area: "Administrativa", position: "Técnico SG-SST" },
];

async function main() {
    console.log('🔐 Creando usuarios con contraseña temporal...');
    console.log(`📝 Contraseña temporal: ${TEMP_PASSWORD}`);
    console.log('');

    // Hash the password
    const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

    // Get areas to map names to IDs
    const areas = await prisma.area.findMany();
    const areaMap = new Map(areas.map(a => [a.name.toLowerCase(), a.id]));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of newUsers) {
        try {
            // Check if user already exists
            const existing = await prisma.user.findUnique({
                where: { email: user.email }
            });

            if (existing) {
                console.log(`⏭️  Ya existe: ${user.email}`);
                skipped++;
                continue;
            }

            // Find area ID
            const areaId = areaMap.get(user.area.toLowerCase());

            if (!areaId) {
                console.log(`⚠️  Área no encontrada para ${user.name}: "${user.area}"`);
                errors.push(`${user.name} - Área "${user.area}" no existe`);
                continue;
            }

            // Create user
            await prisma.user.create({
                data: {
                    name: user.name,
                    email: user.email,
                    password: hashedPassword,
                    role: 'USER',
                    areaId: areaId,
                    mustChangePassword: true, // Forzar cambio de contraseña
                    isActive: true
                }
            });

            console.log(`✅ Creado: ${user.name} (${user.email})`);
            created++;
        } catch (error: any) {
            console.error(`❌ Error creando ${user.name}:`, error.message);
            errors.push(`${user.name} - ${error.message}`);
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`✅ Usuarios creados: ${created}`);
    console.log(`⏭️  Usuarios omitidos (ya existían): ${skipped}`);
    console.log(`❌ Errores: ${errors.length}`);
    if (errors.length > 0) {
        console.log('');
        console.log('Errores:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`🔐 CONTRASEÑA TEMPORAL: ${TEMP_PASSWORD}`);
    console.log('   Los usuarios deberán cambiarla al iniciar sesión.');
    console.log('═══════════════════════════════════════════');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
