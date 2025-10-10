import type { Request, Response } from 'express';
import express from 'express';

import { prisma } from './db.js';

export const notificationsRouter = express.Router();

type AuthedRequest = Request & { user?: { id?: string } };

notificationsRouter.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const where: Record<string, unknown> = {};
    const currentUserId = req.user?.id;
    const userId = (req.query.userId as string | undefined) ?? currentUserId ?? undefined;
    const tenantId = req.query.tenantId as string | undefined;
    if (userId) where.userId = userId;
    if (tenantId) where.tenantId = tenantId;

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    res.json({ ok: true, items });
  } catch (error) {
    res.status(400).json({ ok: false, error: 'Bildirimler alınamadı' });
  }
});

notificationsRouter.get('/unread/count', async (req: AuthedRequest, res: Response) => {
  try {
    const where: Record<string, unknown> = { isRead: false };
    const currentUserId = req.user?.id;
    const userId = (req.query.userId as string | undefined) ?? currentUserId ?? undefined;
    const tenantId = req.query.tenantId as string | undefined;
    if (userId) where.userId = userId;
    if (tenantId) where.tenantId = tenantId;

    const count = await prisma.notification.count({ where });
    res.json({ ok: true, count });
  } catch (error) {
    res.status(400).json({ ok: false, error: 'Okunmamış bildirim sayısı alınamadı' });
  }
});

// MP-18 Fix Pack: lock mark-all to current principal
notificationsRouter.post('/unread/mark-all', async (req: AuthedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
    const tenantId = req.body?.tenantId as string | undefined;
    const where: Record<string, unknown> = { isRead: false, userId: currentUserId };
    if (tenantId) where.tenantId = tenantId;

    const result = await prisma.notification.updateMany({ where, data: { isRead: true } });
    res.json({ ok: true, updated: result.count });
  } catch (error) {
    res.status(400).json({ ok: false, error: 'Okunmamış bildirimleri işaretleme hatası' });
  }
});

// MP-18 Fix Pack: ensure notification mark-read respects ownership
notificationsRouter.post('/:id/read', async (req: AuthedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
    const item = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== currentUserId) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Record to update not found')
      ? 'Not found'
      : 'Bildirim güncellenemedi';
    res.status(message == 'Not found' ? 404 : 400).json({ ok: false, error: message });
  }
});
