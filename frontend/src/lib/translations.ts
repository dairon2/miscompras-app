"use client";

/**
 * Utility functions for translating application labels to Spanish
 */

// Status translations
export const translateStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
        // Requirement statuses
        'APPROVED': 'Aprobado',
        'REJECTED': 'Rechazado',
        'PENDING': 'Pendiente',
        'PENDING_APPROVAL': 'Por aprobar',
        'APPROVED_FOR_PURCHASE': 'Aprobado para compra',
        'DRAFT': 'Borrador',

        // Procurement statuses
        'FINALIZADO': 'Finalizado',
        'ANULADO': 'Anulado',
        'ENTREGADO': 'Entregado',
        'EN_TRAMITE': 'En trámite',
        'POSTERGADO': 'Postergado',
        'PENDIENTE': 'Pendiente',
        'RECEIVED_SATISFACTION': 'Recibido a satisfacción',

        // Invoice statuses
        'RECEIVED': 'Recibida',
        'PAID': 'Pagada',
        'OVERDUE': 'Vencida',

        // Budget statuses
        'ACTIVE': 'Activo',
        'INACTIVE': 'Inactivo',
        'CLOSED': 'Cerrado',
    };

    return statusMap[status] || status.replace(/_/g, ' ');
};

// Log action translations
export const translateAction = (action: string): string => {
    const actionMap: Record<string, string> = {
        'STATUS_UPDATED': 'Estado actualizado',
        'CREATED': 'Creado',
        'UPDATED': 'Actualizado',
        'DELETED': 'Eliminado',
        'APPROVED': 'Aprobado',
        'REJECTED': 'Rechazado',
        'COMMENT_ADDED': 'Comentario agregado',
        'ATTACHMENT_ADDED': 'Adjunto agregado',
        'ATTACHMENT_REMOVED': 'Adjunto eliminado',
        'ASSIGNED': 'Asignado',
        'UNASSIGNED': 'Desasignado',
        'PROCUREMENT_UPDATED': 'Trámite actualizado',
        'INVOICE_ADDED': 'Factura agregada',
        'BUDGET_ASSIGNED': 'Presupuesto asignado',
        'AMOUNT_UPDATED': 'Monto actualizado',
        'SUPPLIER_RATED': 'Proveedor Evaluado',
        'PAYMENT_REGISTERED': 'Pago Registrado',
        'PAYMENT_DELETED': 'Pago Eliminado',
        // Asiento-related actions
        'CREATED_ASIENTO': 'Asiento creado',
        'UPDATED_ASIENTO': 'Asiento actualizado',
        'ASIENTO_CREATED': 'Asiento creado',
        'ASIENTO_STATUS_UPDATED': 'Estado del asiento actualizado',
        'EDITED': 'Editado',
        'OBSERVATIONS_UPDATED': 'Observaciones actualizadas',
        // Group-related actions
        'GROUP_APPROVED': 'Grupo aprobado',
        'GROUP_REJECTED': 'Grupo rechazado',
        'GROUP_CREATED': 'Grupo creado',
        'COORDINATOR_APPROVED': 'Aprobado por Coordinación',
        'COORDINATOR_REJECTED': 'Rechazado por Coordinación',
        'DIRECTOR_APPROVED': 'Aprobado por Dirección',
        'DIRECTOR_REJECTED': 'Rechazado por Dirección',
        'LEADER_APPROVED': 'Aprobado por Líder',
        'LEADER_REJECTED': 'Rechazado por Líder',
        'PROBLEM_REPORTED': '⚠️ Problema Reportado',
    };

    return actionMap[action] || action.replace(/_/g, ' ');
};

// Translate log details (status changes, etc.)
export const translateLogDetails = (details: string): string => {
    if (!details) return '';

    // Common patterns to translate
    let translated = details
        .replace(/APPROVED/g, 'Aprobado')
        .replace(/REJECTED/g, 'Rechazado')
        .replace(/PENDING_APPROVAL/g, 'Por aprobar')
        .replace(/PENDING/g, 'Pendiente')
        .replace(/DRAFT/g, 'Borrador')
        .replace(/RECEIVED/g, 'Recibido')
        .replace(/PAID/g, 'Pagado')
        .replace(/FINALIZADO/g, 'Finalizado')
        .replace(/EN_TRAMITE/g, 'En trámite')
        .replace(/Change status to/gi, 'Cambio de estado a')
        .replace(/Cambio de estado a/gi, 'Cambio de estado a')
        .replace(/Status changed to/gi, 'Estado cambiado a')
        .replace(/Created by/gi, 'Creado por')
        .replace(/Updated by/gi, 'Actualizado por')
        .replace(/Approved by/gi, 'Aprobado por')
        .replace(/Rejected by/gi, 'Rechazado por')
        .replace(/Comment:/gi, 'Comentario:')
        .replace(/Por:/gi, 'Por:')
        // Group-related translations
        .replace(/Group (\d+) approved by/gi, 'Grupo $1 aprobado por')
        .replace(/Group (\d+) rejected by/gi, 'Grupo $1 rechazado por')
        .replace(/Group approved by/gi, 'Grupo aprobado por')
        .replace(/Group rejected by/gi, 'Grupo rechazado por')
        .replace(/approved by Director/gi, 'aprobado por Dirección')
        .replace(/approved by Coordinator/gi, 'aprobado por Coordinación')
        .replace(/rejected by Director/gi, 'rechazado por Dirección')
        .replace(/rejected by Coordinator/gi, 'rechazado por Coordinación')
        // Asiento-related translations
        .replace(/Asiento contable creado por/gi, 'Asiento contable creado por')
        .replace(/Accounting entry created by/gi, 'Asiento contable creado por')
        .replace(/Pre-approved requirement created as asiento/gi, 'Requerimiento pre-aprobado creado como asiento')
        .replace(/created as asiento/gi, 'creado como asiento')
        .replace(/Requirement created/gi, 'Requerimiento creado')
        .replace(/Budget updated/gi, 'Presupuesto actualizado')
        .replace(/Status updated/gi, 'Estado actualizado');

    return translated;
};

// Category translations
export const translateCategory = (category: string): string => {
    const categoryMap: Record<string, string> = {
        'COMPRA': 'Compra',
        'SERVICIO': 'Servicio',
        'REEMBOLSO': 'Reembolso',
        'OTRO': 'Otro',
    };

    return categoryMap[category] || category;
};

// Role translations
export const translateRole = (role: string): string => {
    const roleMap: Record<string, string> = {
        'ADMIN': 'Administrador',
        'DIRECTOR': 'Director',
        'LEADER': 'Líder',
        'COORDINATOR': 'Coordinador',
        'USER': 'Usuario',
        'AUDITOR': 'Auditor',
        'DEVELOPER': 'Desarrollador',
    };

    return roleMap[role] || role;
};

// Activity type translations
export const translateActivityType = (type: string): string => {
    const typeMap: Record<string, string> = {
        'requirement': 'Requerimiento',
        'budget': 'Presupuesto',
        'invoice': 'Factura',
        'adjustment': 'Ajuste',
    };

    return typeMap[type] || type;
};
