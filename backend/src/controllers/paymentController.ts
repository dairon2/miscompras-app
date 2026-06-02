import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';

const GLOBAL_PAYMENT_VIEW_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'];
const GLOBAL_PAYMENT_MANAGE_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'];

const hasRole = (role: string | undefined, roles: string[]) => roles.includes(role || '');

const canAccessRequirementPayments = (requirement: any, req: AuthRequest) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (hasRole(userRole, GLOBAL_PAYMENT_VIEW_ROLES)) return true;
    if (!userId) return false;

    return requirement.createdById === userId ||
        requirement.currentOwnerId === userId ||
        requirement.project?.leaderId === userId ||
        requirement.project?.subLeaderId === userId ||
        requirement.area?.directorId === userId ||
        requirement.budget?.managerId === userId ||
        requirement.budget?.subLeaders?.some((subLeader: { userId: string }) => subLeader.userId === userId);
};

const canManageRequirementPayments = (requirement: any, req: AuthRequest) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (hasRole(userRole, GLOBAL_PAYMENT_MANAGE_ROLES)) return true;
    if (userRole !== 'LEADER' || !userId) return false;

    return requirement.project?.leaderId === userId ||
        requirement.project?.subLeaderId === userId ||
        requirement.budget?.managerId === userId ||
        requirement.budget?.subLeaders?.some((subLeader: { userId: string }) => subLeader.userId === userId);
};

const getRequirementWithPaymentAccess = (requirementId: string) => {
    return prisma.requirement.findUnique({
        where: { id: requirementId },
        include: {
            payments: true,
            project: true,
            area: true,
            budget: {
                include: {
                    subLeaders: true
                }
            }
        }
    });
};

// Create a new payment for a requirement
export const createPayment = async (req: AuthRequest, res: Response) => {
    const { requirementId } = req.params;
    const { amount, invoiceNumber, purchaseOrder, paymentDate, observations } = req.body;
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'El monto del pago es requerido y debe ser mayor a 0' });
    }

    try {
        // Get the requirement
        const requirement = await getRequirementWithPaymentAccess(requirementId);

        if (!requirement) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }

        if (!canManageRequirementPayments(requirement, req)) {
            return res.status(403).json({ error: 'No tienes permiso para registrar pagos en este requerimiento' });
        }

        // Check if requirement has multiple payments enabled
        if (!requirement.hasMultiplePayments && requirement.payments.length > 0) {
            return res.status(400).json({ error: 'Este requerimiento no tiene habilitados los pagos múltiples' });
        }

        // Check max 24 payments
        if (requirement.payments.length >= 24) {
            return res.status(400).json({ error: 'Se ha alcanzado el máximo de 24 pagos' });
        }

        // Calculate payment number based on highest existing number
        const maxPayment = await prisma.payment.findFirst({
            where: { requirementId },
            orderBy: { paymentNumber: 'desc' }
        });
        const paymentNumber = (maxPayment?.paymentNumber || 0) + 1;

        // Create the payment
        const payment = await prisma.payment.create({
            data: {
                paymentNumber,
                amount: parsedAmount,
                invoiceNumber,
                purchaseOrder,
                paymentDate: paymentDate ? new Date(paymentDate + 'T12:00:00') : null,
                observations,
                requirementId
            }
        });

        // Log the action
        await prisma.historyLog.create({
            data: {
                action: 'PAYMENT_REGISTERED',
                requirementId,
                details: `Pago #${paymentNumber} registrado por $${parsedAmount.toLocaleString()} - Factura: ${invoiceNumber || 'N/A'}`
            }
        });

        res.status(201).json(payment);
    } catch (error: any) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Error al registrar el pago', details: error.message });
    }
};

// Get all payments for a requirement
export const getPaymentsByRequirement = async (req: AuthRequest, res: Response) => {
    const { requirementId } = req.params;

    try {
        const requirement = await getRequirementWithPaymentAccess(requirementId);
        if (!requirement) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }

        if (!canAccessRequirementPayments(requirement, req)) {
            return res.status(403).json({ error: 'No tienes permiso para consultar pagos de este requerimiento' });
        }

        const payments = await prisma.payment.findMany({
            where: { requirementId },
            orderBy: { paymentNumber: 'asc' }
        });

        res.json(payments);
    } catch (error: any) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Error al obtener los pagos' });
    }
};

// Update a payment
export const updatePayment = async (req: AuthRequest, res: Response) => {
    const { paymentId } = req.params;
    const { amount, invoiceNumber, purchaseOrder, paymentDate, observations } = req.body;
    const parsedAmount = amount !== undefined ? Number(amount) : undefined;

    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
        return res.status(400).json({ error: 'El monto del pago debe ser mayor a 0' });
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                requirement: {
                    include: {
                        payments: true,
                        project: true,
                        area: true,
                        budget: {
                            include: {
                                subLeaders: true
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        if (!canManageRequirementPayments(payment.requirement, req)) {
            return res.status(403).json({ error: 'No tienes permiso para actualizar este pago' });
        }

        const updatedPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                amount: parsedAmount,
                invoiceNumber,
                purchaseOrder,
                paymentDate: paymentDate ? new Date(paymentDate + 'T12:00:00') : undefined,
                observations
            }
        });

        res.json(updatedPayment);
    } catch (error: any) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: 'Error al actualizar el pago' });
    }
};

// Delete a payment
export const deletePayment = async (req: AuthRequest, res: Response) => {
    const { paymentId } = req.params;

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                requirement: {
                    include: {
                        project: true,
                        area: true,
                        budget: {
                            include: {
                                subLeaders: true
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        if (!canManageRequirementPayments(payment.requirement, req)) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar este pago' });
        }

        await prisma.payment.delete({ where: { id: paymentId } });

        // Log the action
        await prisma.historyLog.create({
            data: {
                action: 'PAYMENT_DELETED',
                requirementId: payment.requirementId,
                details: `Pago #${payment.paymentNumber} eliminado`
            }
        });

        res.json({ message: 'Pago eliminado exitosamente' });
    } catch (error: any) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Error al eliminar el pago' });
    }
};

// Toggle multiple payments for a requirement
export const toggleMultiplePayments = async (req: AuthRequest, res: Response) => {
    const { requirementId } = req.params;
    const { hasMultiplePayments } = req.body;

    try {
        const existingRequirement = await getRequirementWithPaymentAccess(requirementId);
        if (!existingRequirement) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }

        if (!canManageRequirementPayments(existingRequirement, req)) {
            return res.status(403).json({ error: 'No tienes permiso para actualizar la configuración de pagos' });
        }

        const requirement = await prisma.requirement.update({
            where: { id: requirementId },
            data: { hasMultiplePayments }
        });

        res.json(requirement);
    } catch (error: any) {
        console.error('Error toggling multiple payments:', error);
        res.status(500).json({ error: 'Error al actualizar la configuración de pagos' });
    }
};
