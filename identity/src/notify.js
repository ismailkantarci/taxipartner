import fetch from 'node-fetch';
import { prisma } from './db.js';
import { sendInviteMail as sendMail } from './mail.js';
export async function notify(input) {
    const meta = input.meta ? JSON.stringify(input.meta) : null;
    const notification = await prisma.notification.create({
        data: {
            userId: input.userId ?? null,
            tenantId: input.tenantId ?? null,
            channel: input.channel,
            subject: input.subject ?? null,
            body: input.body ?? null,
            metaJson: meta
        }
    });
    try {
        if (input.channel === 'email') {
            const target = input.toEmail ?? process.env.DEFAULT_NOTIFY_EMAIL ?? undefined;
            if (target) {
                await sendMail(target, input.subject ?? '(no subject)', input.body ?? '');
            }
        }
        if (input.channel === 'telegram' &&
            process.env.TELEGRAM_BOT_TOKEN &&
            process.env.TELEGRAM_CHAT_ID) {
            const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: `${input.subject ?? ''}\n${input.body ?? ''}`.trim()
                })
            });
        }
    }
    catch (error) {
        const metaJson = {
            ...(input.meta && typeof input.meta === 'object' ? input.meta : {}),
            error: error instanceof Error ? error.message : String(error)
        };
        await prisma.notification.update({
            where: { id: notification.id },
            data: { metaJson: JSON.stringify(metaJson) }
        });
        throw error;
    }
    return notification;
}
