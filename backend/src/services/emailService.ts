import { EmailClient, EmailMessage } from '@azure/communication-email';

// Email configuration - uses Azure Communication Services
const getEmailClient = () => {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    if (!connectionString) {
        console.log('Azure Email not configured, skipping email send');
        return null;
    }
    return new EmailClient(connectionString);
};

const FROM_EMAIL = process.env.AZURE_EMAIL_SENDER || 'DoNotReply@64ee9d58-18ec-428c-9d01-f96ec1303bc6.azurecomm.net';
const APP_NAME = 'MisCompras - Museo de Antioquia';

// Format currency for emails
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

// Base email template
const getEmailTemplate = (title: string, content: string, actionButton?: { text: string; url: string }) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${APP_NAME}</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 20px;">${title}</h2>
                            ${content}
                            ${actionButton ? `
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${actionButton.url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px;">
                                    ${actionButton.text}
                                </a>
                            </div>
                            ` : ''}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 16px 16px;">
                            <p style="color: #666666; font-size: 12px; margin: 0;">
                                Este es un email automático del sistema de gestión de compras.<br>
                                Por favor no responda a este correo.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

// Send email using Azure Communication Services
const sendEmail = async (to: string, subject: string, htmlContent: string) => {
    const client = getEmailClient();
    if (!client) return;

    const message: EmailMessage = {
        senderAddress: FROM_EMAIL,
        content: {
            subject,
            html: htmlContent
        },
        recipients: {
            to: [{ address: to }]
        }
    };

    try {
        const poller = await client.beginSend(message);
        await poller.pollUntilDone();
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email via Azure:', error);
    }
};

// ==================== BUDGET NOTIFICATIONS ====================

interface BudgetEmailData {
    to: string;
    type: 'BUDGET_CREATED' | 'BUDGET_APPROVED' | 'BUDGET_REJECTED';
    budgetTitle: string;
    budgetCode?: string;
    amount: number;
    projectName: string;
    approverName?: string;
}

export const sendBudgetNotificationEmail = async (data: BudgetEmailData) => {
    let subject = '';
    let content = '';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    switch (data.type) {
        case 'BUDGET_CREATED':
            subject = `Nuevo Presupuesto Asignado: ${data.budgetCode || data.budgetTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Se le ha asignado un nuevo presupuesto para su gestión:</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.budgetCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.budgetTitle}</p>
                    <p style="margin: 5px 0;"><strong>Proyecto:</strong> ${data.projectName}</p>
                    <p style="margin: 5px 0;"><strong>Monto:</strong> <span style="color: #667eea; font-weight: bold;">${formatCurrency(data.amount)}</span></p>
                </div>
                <p style="color: #333; line-height: 1.6;">Por favor revise y apruebe el presupuesto en el sistema.</p>
            `;
            break;
        case 'BUDGET_APPROVED':
            subject = `Presupuesto Aprobado: ${data.budgetCode || data.budgetTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">El presupuesto ha sido <span style="color: #28a745; font-weight: bold;">APROBADO</span>:</p>
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.budgetCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.budgetTitle}</p>
                    <p style="margin: 5px 0;"><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
                    ${data.approverName ? `<p style="margin: 5px 0;"><strong>Aprobado por:</strong> ${data.approverName}</p>` : ''}
                </div>
            `;
            break;
        case 'BUDGET_REJECTED':
            subject = `Presupuesto Rechazado: ${data.budgetCode || data.budgetTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">El presupuesto ha sido <span style="color: #dc3545; font-weight: bold;">RECHAZADO</span>:</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.budgetCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.budgetTitle}</p>
                </div>
            `;
            break;
    }

    await sendEmail(data.to, subject, getEmailTemplate(subject, content, { text: 'Ver Presupuestos', url: `${appUrl}/budget` }));
};

// ==================== ADJUSTMENT NOTIFICATIONS ====================

interface AdjustmentEmailData {
    to: string;
    type: 'ADJUSTMENT_REQUESTED' | 'ADJUSTMENT_APPROVED' | 'ADJUSTMENT_REJECTED';
    adjustmentCode?: string;
    adjustmentType: 'INCREASE' | 'TRANSFER';
    amount: number;
    budgetTitle: string;
    reason?: string;
    approverName?: string;
    comment?: string;
}

export const sendAdjustmentNotificationEmail = async (data: AdjustmentEmailData) => {
    let subject = '';
    let content = '';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const typeLabel = data.adjustmentType === 'INCREASE' ? 'Aumento' : 'Movimiento';

    switch (data.type) {
        case 'ADJUSTMENT_REQUESTED':
            subject = `Nueva Solicitud de ${typeLabel}: ${data.adjustmentCode || data.budgetTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Se ha creado una nueva solicitud de ajuste presupuestal:</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.adjustmentCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${typeLabel}</p>
                    <p style="margin: 5px 0;"><strong>Presupuesto:</strong> ${data.budgetTitle}</p>
                    <p style="margin: 5px 0;"><strong>Monto Solicitado:</strong> <span style="color: #856404; font-weight: bold;">${formatCurrency(data.amount)}</span></p>
                    ${data.reason ? `<p style="margin: 10px 0 5px 0;"><strong>Motivo:</strong></p><p style="margin: 0; font-style: italic;">${data.reason}</p>` : ''}
                </div>
                <p style="color: #333; line-height: 1.6;">Por favor revise y apruebe o rechace la solicitud.</p>
            `;
            break;
        case 'ADJUSTMENT_APPROVED':
            subject = `Solicitud Aprobada: ${data.adjustmentCode || typeLabel}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Su solicitud de ajuste presupuestal ha sido <span style="color: #28a745; font-weight: bold;">APROBADA</span> y aplicada:</p>
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.adjustmentCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${typeLabel}</p>
                    <p style="margin: 5px 0;"><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
                    ${data.approverName ? `<p style="margin: 5px 0;"><strong>Aprobado por:</strong> ${data.approverName}</p>` : ''}
                </div>
                <p style="color: #333; line-height: 1.6;">Los cambios han sido aplicados automáticamente al presupuesto.</p>
            `;
            break;
        case 'ADJUSTMENT_REJECTED':
            subject = `Solicitud Rechazada: ${data.adjustmentCode || typeLabel}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Su solicitud de ajuste presupuestal ha sido <span style="color: #dc3545; font-weight: bold;">RECHAZADA</span>:</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Código:</strong> ${data.adjustmentCode || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${typeLabel}</p>
                    <p style="margin: 5px 0;"><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
                    ${data.comment ? `<p style="margin: 10px 0 5px 0;"><strong>Motivo del rechazo:</strong></p><p style="margin: 0; font-style: italic;">${data.comment}</p>` : ''}
                </div>
            `;
            break;
    }

    await sendEmail(data.to, subject, getEmailTemplate(subject, content, { text: 'Ver Solicitudes', url: `${appUrl}/budget/adjustments` }));
};

// ==================== NOTIFY ALL DIRECTORS ====================

export const notifyDirectors = async (subject: string, content: string) => {
    try {
        // Import prisma here to avoid circular dependency
        const { prisma } = await import('../index');

        const directors = await prisma.user.findMany({
            where: { role: 'DIRECTOR' },
            select: { email: true }
        });

        const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const htmlContent = getEmailTemplate(subject, content, { text: 'Ir al Sistema', url: appUrl });

        for (const director of directors) {
            await sendEmail(director.email, subject, htmlContent);
        }
        console.log(`Notification sent to ${directors.length} directors`);
    } catch (error) {
        console.error('Error notifying directors:', error);
    }
};
