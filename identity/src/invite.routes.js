import express from 'express';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import { prisma } from './db.js';
import { hash } from './crypto.js';
import { sign, verifyToken } from './jwt.js';
import { sendInviteMail } from './mail.js';
export const inviteRouter = express.Router();
/** POST /invite/create  body: { email, roles: string[], claims?: any, baseUrl?: string } */
inviteRouter.post('/create', async (req, res) => {
    try {
        const { email, roles = [], claims, baseUrl } = req.body || {};
        if (!email || typeof email !== 'string') {
            res.status(400).json({ ok: false, error: 'email zorunlu' });
            return;
        }
        const payload = { email, roles, claims };
        const token = sign(payload, 60 * 60 * 24 * 7);
        const acceptUrl = `${(baseUrl || 'http://localhost:5174').replace(/\/?$/, '')}/#/invite/accept?token=${encodeURIComponent(token)}`;
        const { previewUrl } = await sendInviteMail(email, 'TAXIPartner – Einladung / Invite', `<p>Merhaba,</p><p>Hesabını oluşturmak için bağlantıya tıkla:</p><p><a href="${acceptUrl}">${acceptUrl}</a></p>`);
        res.json({ ok: true, inviteToken: token, emailPreviewUrl: previewUrl });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error?.message || 'invite_create_failed' });
    }
});
/** POST /invite/accept  body: { token, password, totp?: { setup?: boolean, code?: string } } */
inviteRouter.post('/accept', async (req, res) => {
    try {
        const { token, password, totp } = req.body || {};
        if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
            res.status(400).json({ ok: false, error: 'token ve password zorunludur' });
            return;
        }
        let payload;
        try {
            payload = verifyToken(token);
        }
        catch (error) {
            res.status(400).json({ ok: false, error: 'Davet geçersiz veya süresi dolmuş' });
            return;
        }
        const { email, roles = [], claims } = payload || {};
        if (!email) {
            res.status(400).json({ ok: false, error: 'Davet eksik' });
            return;
        }
        const passwordHash = await hash(password);
        const claimsJson = claims ? JSON.stringify(claims) : null;
        const existing = await prisma.user.findUnique({ where: { email } });
        let user = existing;
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    password: passwordHash,
                    claimsJson
                }
            });
        }
        else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: passwordHash,
                    claimsJson
                }
            });
        }
        if (Array.isArray(roles) && roles.length > 0) {
            const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } });
            for (const r of roleRows) {
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: user.id, roleId: r.id } },
                    update: {},
                    create: { userId: user.id, roleId: r.id }
                });
            }
        }
        let qrDataUrl;
        if (totp?.setup) {
            const secret = authenticator.generateSecret();
            const otpauth = authenticator.keyuri(email, 'TAXIPartner', secret);
            qrDataUrl = await QRCode.toDataURL(otpauth);
            await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret, mfaEnabled: false } });
        }
        if (totp?.code) {
            const current = await prisma.user.findUnique({ where: { id: user.id } });
            if (!current?.mfaSecret) {
                res.status(400).json({ ok: false, error: 'TOTP kurulumu gerekli' });
                return;
            }
            const valid = authenticator.check(String(totp.code), current.mfaSecret);
            if (!valid) {
                res.status(400).json({ ok: false, error: 'TOTP kod hatalı' });
                return;
            }
            await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
        }
        const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
        res.json({
            ok: true,
            userId: user.id,
            mfaEnabled: !!refreshed?.mfaEnabled,
            qrDataUrl
        });
    }
    catch (error) {
        res.status(400).json({ ok: false, error: error?.message || 'invite_accept_failed' });
    }
});
