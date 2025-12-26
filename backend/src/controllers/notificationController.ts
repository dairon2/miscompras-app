import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    } catch (error: any) {
        res.status(400).json({ error: 'Failed to update notification' });
    }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        await prisma.notification.updateMany({
            where: { userId },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
        res.status(400).json({ error: 'Failed to update notifications' });
    }
};
