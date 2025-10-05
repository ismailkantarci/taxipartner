import cron from 'node-cron';

import { prisma } from './db.js';
import { notify } from './notify.js';

type ChannelConfig = {
  email?: boolean;
  telegram?: boolean;
  inapp?: boolean;
};

let schedulerStarted = false;

export function startTaskScheduler() {
  if (String(process.env.DISABLE_SCHEDULER || '').toLowerCase() === 'true') {
    console.log('[scheduler] disabled by env');
    return;
  }
  if (schedulerStarted) return;
  schedulerStarted = true;

  const cronExpr = process.env.TASK_TICK_CRON || '*/1 * * * *';

  cron.schedule(cronExpr, async () => {
    const tasks = await prisma.task.findMany({ where: { isEnabled: true } });

    for (const task of tasks) {
      const run = await prisma.taskRun.create({
        data: {
          taskId: task.id,
          status: 'STARTED'
        }
      });

      try {
        const channels = parseJson<ChannelConfig>(task.channels) ?? {};
        const payload = parseJson<Record<string, unknown>>(task.payload) ?? {};

        const subject = (payload.subject as string) || task.name;
        const body = (payload.body as string) || '';
        const toEmail = (payload.to as string | undefined) ?? process.env.DEFAULT_NOTIFY_EMAIL ?? undefined;
        const userId = payload.userId as string | undefined;
        const tenantId = payload.tenantId as string | undefined;

        if (channels.email) {
          await notify({ channel: 'email', toEmail, subject, body, meta: { taskId: task.id, runId: run.id } });
        }

        if (channels.telegram) {
          await notify({ channel: 'telegram', subject, body, meta: { taskId: task.id, runId: run.id } });
        }

        if (channels.inapp) {
          await notify({
            channel: 'inapp',
            userId,
            tenantId,
            subject,
            body,
            meta: { taskId: task.id, runId: run.id }
          });
        }

        await prisma.taskRun.update({
          where: { id: run.id },
          data: { status: 'SUCCESS', finishedAt: new Date() }
        });

        await prisma.task.update({
          where: { id: task.id },
          data: { lastRunAt: new Date() }
        });
      } catch (error) {
        await prisma.taskRun.update({
          where: { id: run.id },
          data: {
            status: 'ERROR',
            finishedAt: new Date(),
            message: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  });
}

function parseJson<T>(input: string | null | undefined): T | undefined {
  if (!input) return undefined;
  try {
    return JSON.parse(input) as T;
  } catch {
    return undefined;
  }
}
