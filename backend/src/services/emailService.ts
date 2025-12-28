import { EmailClient } from '@azure/communication-email';

// Initialize email client with connection string from environment variable
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;

let emailClient: EmailClient | null = null;

if (connectionString) {
    emailClient = new EmailClient(connectionString);
}

export interface EmailOptions {
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
    if (!emailClient) {
        console.warn('Azure Communication Services not configured. Email not sent.');
        console.log('Would have sent email to:', options.to);
        console.log('Subject:', options.subject);
        return false;
    }

    const senderAddress = process.env.AZURE_EMAIL_SENDER || 'noreply@museodeantioquia.co';

    try {
        const message = {
            senderAddress,
            content: {
                subject: options.subject,
                html: options.htmlContent,
                plainText: options.textContent || options.subject,
            },
            recipients: {
                to: [{ address: options.to }],
            },
        };

        const poller = await emailClient.beginSend(message);
        const result = await poller.pollUntilDone();

        console.log(`Email sent successfully to ${options.to}. Status: ${result.status}`);
        return result.status === 'Succeeded';
    } catch (error: any) {
        console.error('Failed to send email:', error.message);
        return false;
    }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'https://miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Sistema de Compras</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Museo de Antioquia</p>
            </div>
            <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #1e293b; margin-top: 0;">Recuperar Contraseña</h2>
                <p style="color: #64748b; line-height: 1.6;">
                    Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. 
                    Haz clic en el botón de abajo para crear una nueva contraseña.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                              color: white; 
                              padding: 14px 32px; 
                              border-radius: 12px; 
                              text-decoration: none; 
                              font-weight: bold;
                              display: inline-block;">
                        Restablecer Contraseña
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
                    Este enlace expirará en <strong>1 hora</strong>. Si no solicitaste este cambio, 
                    puedes ignorar este correo de forma segura.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${resetLink}" style="color: #6366f1;">${resetLink}</a>
                </p>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Museo de Antioquia. Todos los derechos reservados.
            </p>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Restablecer Contraseña - Sistema de Compras',
        htmlContent,
        textContent: `Haz clic en el siguiente enlace para restablecer tu contraseña: ${resetLink}. Este enlace expirará en 1 hora.`
    });
}
