"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getMyNotifications = void 0;
const index_1 = require("../index");
const getMyNotifications = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'User not authenticated' });
    try {
        const notifications = await index_1.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
exports.getMyNotifications = getMyNotifications;
const markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        await index_1.prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to update notification' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'User not authenticated' });
    try {
        await index_1.prisma.notification.updateMany({
            where: { userId },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to update notifications' });
    }
};
exports.markAllAsRead = markAllAsRead;
