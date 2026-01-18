const nodemailer = require('nodemailer');
require('dotenv').config();

async function test() {
    console.log('=== PRUEBA SMTP HOSTINGER ===\n');

    const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    };

    console.log('Configuracion:');
    console.log('  Host:', config.host);
    console.log('  Port:', config.port);
    console.log('  User:', config.user);
    console.log('  Pass:', config.pass ? '[CONFIGURADO]' : '[NO CONFIGURADO]');
    console.log('');

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: true,
        auth: {
            user: config.user,
            pass: config.pass
        }
    });

    try {
        console.log('1. Verificando conexion SMTP...');
        await transporter.verify();
        console.log('   [OK] Conexion establecida\n');

        console.log('2. Enviando correo de prueba...');
        const result = await transporter.sendMail({
            from: '"MisCompras - DMR Tech" <contacto@dmrtech.cloud>',
            to: 'daironmoreno24@gmail.com',
            subject: '[TEST] Correo de Prueba - ' + new Date().toLocaleString('es-CO'),
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #667eea;">Prueba de SMTP Exitosa</h2>
                    <p>Este correo fue enviado desde: <strong>contacto@dmrtech.cloud</strong></p>
                    <p>Fecha: ${new Date().toLocaleString('es-CO')}</p>
                    <hr>
                    <p style="color: green;">Si recibes este correo, la configuracion SMTP funciona correctamente.</p>
                </div>
            `
        });
        console.log('   [OK] Correo enviado');
        console.log('   Message ID:', result.messageId);
        console.log('   Accepted:', result.accepted);
        console.log('   Rejected:', result.rejected);
        console.log('\n=== PRUEBA COMPLETADA EXITOSAMENTE ===');
    } catch (err) {
        console.log('   [ERROR]', err.message);
        console.log('');
        console.log('Detalles del error:');
        console.log('  Code:', err.code);
        console.log('  Command:', err.command);
        console.log('  Response:', err.response);
    }
}

test();
