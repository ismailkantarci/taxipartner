import { prisma } from '../src/db.js';

async function main() {
  const name = 'SMOKE: In-app demo';
  const cron = '*/5 * * * *';
  const channels = { inapp: true };
  const payload = {
    subject: 'Smoke',
    body: 'Merhaba! Bu bir smoke test bildirimi.'
  };

  const existing = await prisma.task.findFirst({ where: { name } });

  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: {
        cron,
        channels: JSON.stringify(channels),
        payload: JSON.stringify(payload),
        isEnabled: true
      }
    });
    console.log('[SMOKE] Updated task:', existing.id);
  } else {
    const created = await prisma.task.create({
      data: {
        name,
        cron,
        channels: JSON.stringify(channels),
        payload: JSON.stringify(payload),
        isEnabled: true
      }
    });
    console.log('[SMOKE] Created task:', created.id);
  }

  console.log('[SMOKE] Hazır. `POST /tasks/:id/run` ile elle tetikleyebilir ya da cron bekleyebilirsin.');
}

main().catch((error) => {
  console.error('[SMOKE] Hata:', error);
  process.exit(1);
});
