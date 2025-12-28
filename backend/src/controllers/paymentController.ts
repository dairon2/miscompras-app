import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';

// Create a new payment for a requirement
export const createPayment = async (req: AuthRequest, res: Response) => {
    const { requirementId } = req.params;
    const { amount, invoiceNumber, paymentDate, observations } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'El monto del pago es requerido y debe ser mayor a 0' });
    }

    try {
        // Get the requirement
        const requirement = await prisma.requirement.findUnique({
            where: { id: requirementId },
            include: { payments: true }
        });

        if (!requirement) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }

        // Check if requirement has multiple payments enabled
        if (!requirement.hasMultiplePayments && requirement.payments.length > 0) {
            return res.status(400).json({ error: 'Este requerimiento no tiene habilitados los pagos múltiples' });
        }

        // Check max 12 payments
        if (requirement.payments.length >= 12) {
            return res.status(400).json({ error: 'Se ha alcanzado el máximo de 12 pagos' });
        }

        // Calculate payment number
        const paymentNumber = requirement.payments.length + 1;

        // Validate total doesn't exceed requirement amount
        const totalPaid = requirement.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
        const newTotal = totalPaid + parseFloat(amount);
        const requirementTotal = parseFloat(requirement.totalAmount?.toString() || requirement.actualAmount?.toString() || '0');

        if (requirementTotal > 0 && newTotal > requirementTotal) {
            return res.status(400).json({
                error: `El total de pagos ($${newTotal.toLocaleString()}) excede el monto del requerimiento ($${requirementTotal.toLocaleString()})`
            });
        }

        // Create the payment
        const payment = await prisma.payment.create({
            data: {
                paymentNumber,
                amount: parseFloat(amount),
                invoiceNumber,
                paymentDate: paymentDate ? new Date(paymentDate) : null,
                observations,
                requirementId
            }
        });

        // Update requirement status based on total paid
        if (requirementTotal > 0) {
            const isFullyPaid = newTotal >= requirementTotal;
            const newProcStatus = isFullyPaid ? 'FINALIZADO' : 'EN_TRAMITE';

            if (requirement.procurementStatus !== newProcStatus) {
                await prisma.requirement.update({
                    where: { id: requirementId },
                    data: { procurementStatus: newProcStatus as any }
                });

                await prisma.historyLog.create({
                    data: {
                        action: 'STATUS_UPDATED',
                        requirementId,
                        details: `Estado de adquisición actualizado a ${newProcStatus} debido al registro de pago.`
                    }
                });
            }
        }

        // Log the action
        await prisma.historyLog.create({
            data: {
                action: 'PAYMENT_REGISTERED',
                requirementId,
                details: `Pago #${paymentNumber} registrado por $${parseFloat(amount).toLocaleString()} - Factura: ${invoiceNumber || 'N/A'}`
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
    const { amount, invoiceNumber, paymentDate, observations } = req.body;

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { requirement: { include: { payments: true } } }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        // Validate new total if amount changed
        if (amount !== undefined) {
            const otherPaymentsTotal = payment.requirement.payments
                .filter(p => p.id !== paymentId)
                .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
            const newTotal = otherPaymentsTotal + parseFloat(amount);
            const requirementTotal = parseFloat(payment.requirement.totalAmount?.toString() || payment.requirement.actualAmount?.toString() || '0');

            if (requirementTotal > 0 && newTotal > requirementTotal) {
                return res.status(400).json({
                    error: `El total de pagos ($${newTotal.toLocaleString()}) excede el monto del requerimiento ($${requirementTotal.toLocaleString()})`
                });
            }
        }

        const updatedPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                invoiceNumber,
                paymentDate: paymentDate ? new Date(paymentDate) : undefined,
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
            where: { id: paymentId }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
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
