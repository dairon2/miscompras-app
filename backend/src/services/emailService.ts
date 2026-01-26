import nodemailer from 'nodemailer';

// Email configuration - uses SMTP (Hostinger)
const createTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.log('[Email] SMTP not configured, skipping email send');
        return null;
    }

    console.log(`[Email] SMTP Host: ${host}, Port: ${port}, User: ${user}`);

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user,
            pass
        }
    });
};

// Get sender email at runtime
const getSenderEmail = () => {
    const email = process.env.EMAIL_FROM || process.env.SMTP_USER || 'contacto@dmrtech.cloud';
    const name = process.env.EMAIL_FROM_NAME || 'MisCompras';
    console.log(`[Email] Using sender: ${name} <${email}>`);
    return { email, name };
};

const APP_NAME = process.env.EMAIL_FROM_NAME || 'MisCompras - DMR Tech';

// Format currency for emails
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

// Base email template
export const getEmailTemplate = (title: string, content: string, actionButton?: { text: string; url: string }) => `
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

// Send email using SMTP (Hostinger)
export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
    console.log(`[Email] Attempting to send email to: ${to}, subject: "${subject}"`);

    // Check if emails are disabled (for development/testing)
    if (process.env.DISABLE_EMAILS === 'true') {
        console.log('[Email] 🚫 EMAILS DISABLED - Skipping actual send');
        console.log(`[Email] 📧 Would have sent to: ${to}`);
        console.log(`[Email] 📝 Subject: ${subject}`);
        return;
    }

    const transporter = createTransporter();
    if (!transporter) {
        console.warn('[Email] ⚠️ Email not configured - SMTP credentials are missing');
        return;
    }

    const sender = getSenderEmail();

    try {
        const info = await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to,
            subject,
            html: htmlContent
        });
        console.log(`[Email] ✅ Email sent successfully to ${to}, Message ID: ${info.messageId}`);
    } catch (error: any) {
        console.error(`[Email] ❌ Error sending email to ${to}:`, error.message);
        if (error.code) console.error(`[Email] Error code: ${error.code}`);
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

// ==================== PASSWORD RESET EMAIL ====================

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const subject = 'Restablecer Contraseña - MisCompras';
    const content = `
        <p style="color: #333; line-height: 1.6;">Has solicitado restablecer tu contraseña.</p>
        <p style="color: #333; line-height: 1.6;">Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px;">
                Restablecer Contraseña
            </a>
        </div>
        <p style="color: #666; font-size: 12px;">Este enlace expirará en 1 hora.</p>
        <p style="color: #666; font-size: 12px;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    `;

    await sendEmail(email, subject, getEmailTemplate(subject, content));
};

// ==================== REQUIREMENT NOTIFICATIONS ====================

export interface RequirementEmailData {
    to: string;
    type: 'REQUIREMENT_CREATED' | 'REQUIREMENT_APPROVED' | 'REQUIREMENT_REJECTED';
    requirementTitle: string;
    requirementId: string;
    groupId?: number;
    amount?: number;
    project?: string;
    requesterName?: string;
    approverName?: string;
    rejectReason?: string;
}

export const sendRequirementNotificationEmail = async (data: RequirementEmailData) => {
    let subject = '';
    let content = '';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const reqLabel = data.groupId ? `Solicitud #${data.groupId}` : `Requerimiento`;

    switch (data.type) {
        case 'REQUIREMENT_CREATED':
            subject = `Nueva Solicitud Creada: ${data.groupId ? '#' + data.groupId : data.requirementTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Se ha creado una nueva solicitud que requiere su atención:</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>ID:</strong> ${data.groupId ? '#' + data.groupId : data.requirementId.substring(0, 8)}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.requirementTitle}</p>
                    <p style="margin: 5px 0;"><strong>Solicitante:</strong> ${data.requesterName}</p>
                    ${data.amount ? `<p style="margin: 5px 0;"><strong>Monto Estimado:</strong> <span style="color: #667eea; font-weight: bold;">${formatCurrency(data.amount)}</span></p>` : ''}
                    ${data.project ? `<p style="margin: 5px 0;"><strong>Proyecto:</strong> ${data.project}</p>` : ''}
                </div>
                <p style="color: #333; line-height: 1.6;">Por favor ingrese al sistema para revisar y aprobar/rechazar.</p>
            `;
            break;

        case 'REQUIREMENT_APPROVED':
            subject = `Solicitud Aprobada: ${data.groupId ? '#' + data.groupId : data.requirementTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Su solicitud ha sido <span style="color: #28a745; font-weight: bold;">APROBADA</span>:</p>
                <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>ID:</strong> ${data.groupId ? '#' + data.groupId : data.requirementId.substring(0, 8)}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.requirementTitle}</p>
                    ${data.approverName ? `<p style="margin: 5px 0;"><strong>Aprobado por:</strong> ${data.approverName}</p>` : ''}
                </div>
                <p style="color: #333; line-height: 1.6;">El proceso de compras continuará automáticamente.</p>
            `;
            break;

        case 'REQUIREMENT_REJECTED':
            subject = `Solicitud Rechazada: ${data.groupId ? '#' + data.groupId : data.requirementTitle}`;
            content = `
                <p style="color: #333; line-height: 1.6;">Su solicitud ha sido <span style="color: #dc3545; font-weight: bold;">RECHAZADA</span>:</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>ID:</strong> ${data.groupId ? '#' + data.groupId : data.requirementId.substring(0, 8)}</p>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${data.requirementTitle}</p>
                    ${data.rejectReason ? `<p style="margin: 10px 0 5px 0;"><strong>Motivo:</strong></p><p style="margin: 0; font-style: italic;">${data.rejectReason}</p>` : ''}
                </div>
                <p style="color: #333; line-height: 1.6;">Puede revisar los detalles en el sistema.</p>
            `;
            break;
    }

    await sendEmail(data.to, subject, getEmailTemplate(subject, content, { text: 'Ver Solicitud', url: `${appUrl}/requirements/${data.requirementId}` }));
};

// ==================== CONTRACT EMAIL ====================

export interface ContractEmailData {
    to: string;
    supplierName: string;
    contractNumber: string;
    requirementTitle: string;
    amount: number;
    contractHtml: string;
}

export const sendContractEmail = async (data: ContractEmailData) => {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const subject = `Contrato de Prestación de Servicios - ${data.contractNumber}`;
    const coverContent = `
        <p style="color: #333; line-height: 1.6;">Estimado(a) <strong>${data.supplierName}</strong>,</p>
        
        <p style="color: #333; line-height: 1.6;">
            Adjunto encontrará el contrato correspondiente a la prestación de servicios para el Museo de Antioquia.
        </p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Contrato No.:</strong> ${data.contractNumber}</p>
            <p style="margin: 5px 0;"><strong>Concepto:</strong> ${data.requirementTitle}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> <span style="color: #667eea; font-weight: bold;">${formatCurrency(data.amount)}</span></p>
        </div>
        
        <p style="color: #333; line-height: 1.6;">
            Por favor revise el documento y, si está de acuerdo con los términos, proceda a firmarlo.
            Para cualquier duda o aclaración, no dude en contactarnos.
        </p>
        
        <div style="margin-top: 30px; padding: 20px; background: #e8f4f8; border-radius: 8px; border-left: 4px solid #667eea;">
            <p style="margin: 0; color: #333;">
                <strong>📄 Ver contrato:</strong> El contrato completo se encuentra al final de este correo.
            </p>
        </div>
    `;

    // Combine cover email with full contract
    const fullHtml = getEmailTemplate(subject, coverContent, { text: 'Ir al Sistema', url: appUrl }) +
        '<div style="page-break-before: always;"></div>' +
        data.contractHtml;

    await sendEmail(data.to, subject, fullHtml);
    console.log(`[Contract] Contract ${data.contractNumber} sent to ${data.to}`);
};
