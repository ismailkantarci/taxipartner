import express from 'express';
import { prisma } from './db.js';
export const notificationsRouter = express.Router();
notificationsRouter.get('/', async (req, res) => {
    try {
        const where = {};
        const currentUserId = req.user?.id;
        const userId = req.query.userId ?? currentUserId ?? undefined;
        const tenantId = req.query.tenantId;
        if (userId)
            where.userId = userId;
        if (tenantId)
            where.tenantId = tenantId;
        const items = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        res.json({ ok: true, items });
    }
    catch (error) {
        res.status(400).json({ ok: false, error: 'Bildirimler alınamadı' });
    }
});
notificationsRouter.get('/unread/count', async (req, res) => {
    try {
        const where = { isRead: false };
        const currentUserId = req.user?.id;
        const userId = req.query.userId ?? currentUserId ?? undefined;
        const tenantId = req.query.tenantId;
        if (userId)
            where.userId = userId;
        if (tenantId)
            where.tenantId = tenantId;
        const count = await prisma.notification.count({ where });
        res.json({ ok: true, count });
    }
    catch (error) {
        res.status(400).json({ ok: false, error: 'Okunmamış bildirim sayısı alınamadı' });
    }
});
notificationsRouter.post('/unread/mark-all', async (req, res) => {
    try {
        const where = { isRead: false };
        const currentUserId = req.user?.id;
        const userId = req.body?.userId ?? currentUserId ?? undefined;
        const tenantId = req.body?.tenantId;
        if (userId)
            where.userId = userId;
        if (tenantId)
            where.tenantId = tenantId;
        const result = await prisma.notification.updateMany({ where, data: { isRead: true } });
        res.json({ ok: true, updated: result.count });
    }
    catch (error) {
        res.status(400).json({ ok: false, error: 'Okunmamış bildirimleri işaretleme hatası' });
    }
});
notificationsRouter.post('/:id/read', async (req, res) => {
    try {
        await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
        res.json({ ok: true });
    }
    catch (error) {
        const message = error instanceof Error && error.message.includes('Record to update not found')
            ? 'Bildirim bulunamadı'
            : 'Bildirim güncellenemedi';
        res.status(message === 'Bildirim bulunamadı' ? 404 : 400).json({ ok: false, error: message });
    }
});
