// Test SMTP connection and send a test email
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
    console.log('🔧 Testing SMTP Configuration...\n');

    const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    };

    console.log('📧 SMTP Configuration:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Secure: ${config.secure}`);
    console.log(`   User: ${config.user}`);
    console.log('');

    if (!config.host || !config.user || !config.pass) {
        console.error('❌ Missing SMTP configuration. Please check your .env file.');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    });

    try {
        // Verify connection
        console.log('🔍 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully!\n');

        // Send test email
        const testRecipient = process.argv[2] || config.user; // Send to self if no recipient provided
        console.log(`📤 Sending test email to: ${testRecipient}`);

        const info = await transporter.sendMail({
            from: `"MisCompras - DMR Tech" <${config.user}>`,
            to: testRecipient,
            subject: '✅ Test Email - MisCompras SMTP Configuration',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
                    <h1 style="color: white; margin: 0;">¡Configuración Exitosa! 🎉</h1>
                </div>
                <div style="padding: 20px; background: #f8f9fa;">
                    <p>Este correo confirma que el servidor SMTP de <strong>Hostinger</strong> está correctamente configurado.</p>
                    <p><strong>Detalles de configuración:</strong></p>
                    <ul>
                        <li>Servidor: ${config.host}</li>
                        <li>Puerto: ${config.port}</li>
                        <li>Remitente: ${config.user}</li>
                        <li>Fecha: ${new Date().toLocaleString('es-CO')}</li>
                    </ul>
                    <p style="color: #28a745; font-weight: bold;">✅ La aplicación MisCompras ahora puede enviar correos desde tu dominio personalizado.</p>
                </div>
            `
        });

        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`\n🎉 SMTP configuration is working correctly!`);
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.code) console.error(`   Error code: ${error.code}`);
        if (error.response) console.error(`   Response: ${error.response}`);
        process.exit(1);
    }
}

testEmail();
