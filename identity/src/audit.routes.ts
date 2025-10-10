import express from 'express';
import { prisma } from './db.js';

export const auditRouter = express.Router();

auditRouter.get('/', async (req: any, res: any) => {
  try {
    const { q, actorId, tenantId, action, status, from, to } = req.query as Record<string, string>;
    const skip = Number(req.query.skip ?? 0);
    const take = Math.min(Number(req.query.take ?? 50), 200);

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { action: { contains: q } },
        { path: { contains: q } },
        { actorEmail: { contains: q } }
      ];
    }
    if (actorId) where.actorId = actorId;
    if (tenantId) where.tenantId = tenantId;
    if (action) where.action = { contains: action };
    if (status) where.status = Number(status);
    if (from || to) {
      where.ts = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined
      };
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { ts: 'desc' }, skip, take }),
      prisma.auditLog.count({ where })
    ]);

    res.json({ ok: true, items: rows, paging: { skip, take, total } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Listeleme hatası';
    res.status(400).json({ ok: false, error: message });
  }
});

auditRouter.get('/:id', async (req: any, res: any) => {
  try {
    const row = await prisma.auditLog.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ ok: false, error: 'Kayıt bulunamadı' });
      return;
    }
    res.json({ ok: true, item: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Detay hatası';
    res.status(400).json({ ok: false, error: message });
  }
});

auditRouter.get('/export/csv', async (req: any, res: any) => {
  try {
    const { q, actorId, tenantId, action, status, from, to } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { action: { contains: q } },
        { path: { contains: q } },
        { actorEmail: { contains: q } }
      ];
    }
    if (actorId) where.actorId = actorId;
    if (tenantId) where.tenantId = tenantId;
    if (action) where.action = { contains: action };
    if (status) where.status = Number(status);
    if (from || to) {
      where.ts = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined
      };
    }

    const rows = await prisma.auditLog.findMany({ where, orderBy: { ts: 'desc' }, take: 5000 });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit.csv');

    const header = [
      'id',
      'ts',
      'actorId',
      'actorEmail',
      'tenantId',
      'action',
      'method',
      'path',
      'targetType',
      'targetId',
      'status',
      'ip',
      'userAgent'
    ];

    const csv = [header.join(',')].concat(
      rows.map((row) =>
        header
          .map((key) => {
            const value = (row as any)[key];
            const stringValue = value == null ? '' : String(value).replace(/"/g, '""');
            return `"${stringValue}"`;
          })
          .join(',')
      )
    );

    res.end(csv.join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CSV hatası';
    res.status(400).json({ ok: false, error: message });
  }
});
