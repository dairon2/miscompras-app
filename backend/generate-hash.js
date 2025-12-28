const bcrypt = require('bcryptjs');

async function generateAndVerifyHash() {
    const password = 'admin123';

    console.log('='.repeat(50));
    console.log('GENERANDO HASH PARA PASSWORD: admin123');
    console.log('='.repeat(50));

    // Generar hash
    const hash = await bcrypt.hash(password, 10);
    console.log('\n✓ Hash generado:');
    console.log(hash);

    // Verificar que funciona
    const isValid = await bcrypt.compare(password, hash);
    console.log('\n✓ Verificación:', isValid ? 'VÁLIDO ✓' : 'INVÁLIDO ✗');

    // Probar con contraseña incorrecta
    const isInvalid = await bcrypt.compare('wrongpassword', hash);
    console.log('✓ Prueba con contraseña incorrecta:', isInvalid ? 'FALLÓ (debería ser false)' : 'CORRECTO (false) ✓');

    console.log('\n' + '='.repeat(50));
    console.log('COMANDO SQL PARA ACTUALIZAR EN AZURE:');
    console.log('='.repeat(50));
    console.log(`UPDATE "User" SET password = '${hash}' WHERE email = 'admin@museodeantioquia.co';`);
    console.log('='.repeat(50));
}

generateAndVerifyHash().catch(console.error);
