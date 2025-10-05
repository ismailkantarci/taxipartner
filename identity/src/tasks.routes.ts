import express from 'express';

import { prisma } from './db.js';
import { notify } from './notify.js';
import { isValidCron } from './cron.util.js';

export const tasksRouter = express.Router();

function safeStringify(value: unknown, fallback: string = '{}') {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function safeParse<T>(source?: string | null): T | undefined {
  if (!source) return undefined;
  try {
    return JSON.parse(source) as T;
  } catch {
    return undefined;
  }
}

function mustParseJson(name: string, source?: string | null) {
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch {
    throw { status: 400, message: `${name} alanı geçerli JSON değil` };
  }
}

tasksRouter.get('/', async (_req, res) => {
  try {
    const items = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ ok: true, items });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Görevler listelenemedi' });
  }
});

tasksRouter.post('/', async (req, res) => {
  try {
    const { name, description, cron, isEnabled = true, channels = {}, payload = {} } = req.body || {};
    if (!name || !cron) {
      res.status(400).json({ ok: false, error: 'name ve cron alanları zorunludur' });
      return;
    }
    if (!isValidCron(cron)) {
      res.status(400).json({ ok: false, error: 'Geçersiz cron ifadesi' });
      return;
    }
    const task = await prisma.task.create({
      data: {
        name,
        description: description ?? null,
        cron,
        isEnabled: !!isEnabled,
        channels: safeStringify(channels),
        payload: safeStringify(payload, 'null')
      }
    });
    res.status(201).json({ ok: true, task });
  } catch (error) {
    res.status(400).json({ ok: false, error: 'Görev oluşturulamadı' });
  }
});

tasksRouter.put('/:id', async (req, res) => {
  try {
    const { name, description, cron, isEnabled, channels, payload } = req.body || {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description ?? null;
    if (cron !== undefined) {
      if (!isValidCron(cron)) {
        res.status(400).json({ ok: false, error: 'Geçersiz cron ifadesi' });
        return;
      }
      data.cron = cron;
    }
    if (isEnabled !== undefined) data.isEnabled = !!isEnabled;
    if (channels !== undefined) data.channels = safeStringify(channels);
    if (payload !== undefined) data.payload = safeStringify(payload, 'null');

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data
    });
    res.json({ ok: true, task });
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Record to update not found')
      ? 'Görev bulunamadı'
      : 'Görev güncellenemedi';
    res.status(message === 'Görev bulunamadı' ? 404 : 400).json({ ok: false, error: message });
  }
});

tasksRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Record to delete does not exist')
      ? 'Görev bulunamadı'
      : 'Görev silinemedi';
    res.status(message === 'Görev bulunamadı' ? 404 : 400).json({ ok: false, error: message });
  }
});

tasksRouter.post('/:id/run', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      res.status(404).json({ ok: false, error: 'Görev bulunamadı' });
      return;
    }

    const run = await prisma.taskRun.create({
      data: {
        taskId: task.id,
        status: 'STARTED'
      }
    });

    const channels = mustParseJson('channels', task.channels) as { email?: boolean; telegram?: boolean; inapp?: boolean };
    const payload = mustParseJson('payload', task.payload) as Record<string, unknown>;

    const subject = (payload.subject as string) || task.name;
    const body = (payload.body as string) || '';
    const toEmail = (payload.to as string | undefined) ?? process.env.DEFAULT_NOTIFY_EMAIL ?? undefined;
    const userId = payload.userId as string | undefined;
    const tenantId = payload.tenantId as string | undefined;

    try {
      if (channels.email) {
        await notify({ channel: 'email', toEmail, subject, body, meta: { taskId: task.id, runId: run.id, manual: true } });
      }
      if (channels.telegram) {
        await notify({ channel: 'telegram', subject, body, meta: { taskId: task.id, runId: run.id, manual: true } });
      }
      if (channels.inapp) {
        await notify({
          channel: 'inapp',
          userId,
          tenantId,
          subject,
          body,
          meta: { taskId: task.id, runId: run.id, manual: true }
        });
      }

      await prisma.taskRun.update({
        where: { id: run.id },
        data: { status: 'SUCCESS', finishedAt: new Date() }
      });
      await prisma.task.update({ where: { id: task.id }, data: { lastRunAt: new Date() } });
      res.json({ ok: true, message: 'Görev çalıştırıldı', runId: run.id });
    } catch (notifyError) {
      await prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: 'ERROR',
          finishedAt: new Date(),
          message: notifyError instanceof Error ? notifyError.message : String(notifyError)
        }
      });
      res.status(400).json({ ok: false, error: 'Görev çalıştırma hatası', detay: notifyError instanceof Error ? notifyError.message : String(notifyError) });
    }
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? Number(error.status) : 400;
    const message = error?.message || 'Görev çalıştırma isteği tamamlanamadı';
    res.status(status).json({ ok: false, error: message });
  }
});
