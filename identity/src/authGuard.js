import { prisma } from './db.js';
import { verifyToken } from './jwt.js';
import { DEV_BYPASS_AUTH, DEV_BYPASS_EMAIL } from './env.js';
async function ensureDevUser() {
    const role = await prisma.role.upsert({
        where: { name: 'Superadmin' },
        update: {},
        create: {
            name: 'Superadmin',
            scope: 'global',
            isSystem: true,
            isExclusive: true,
            template: false
        }
    });
    const user = await prisma.user.upsert({
        where: { email: DEV_BYPASS_EMAIL },
        update: {},
        create: {
            email: DEV_BYPASS_EMAIL,
            password: 'dev-bypass-placeholder',
            mfaEnabled: false
        }
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id }
    });
    return prisma.user.findUnique({
        where: { id: user.id },
        include: { roles: { include: { role: true } } }
    });
}
let devBypassLogged = false;
export async function authGuard(req, res, next) {
    try {
        if (DEV_BYPASS_AUTH) {
            if (!devBypassLogged) {
                console.log('[authGuard] DEV_BYPASS_AUTH aktif, kullanıcı:', DEV_BYPASS_EMAIL);
                devBypassLogged = true;
            }
            let user = await prisma.user.findUnique({
                where: { email: DEV_BYPASS_EMAIL },
                include: { roles: { include: { role: true } } }
            });
            if (!user) {
                user = await ensureDevUser() ?? null;
            }
            if (!user) {
                res.status(500).json({ ok: false, error: 'Geliştirici baypas kullanıcısı oluşturulamadı.' });
                return;
            }
            req.user = {
                id: user.id,
                email: user.email,
                roles: user.roles.map((entry) => entry.role.name),
                claims: user.claimsJson ? JSON.parse(user.claimsJson) : undefined,
                mfaEnabled: user.mfaEnabled
            };
            req.session = null;
            req.token = 'dev-bypass';
            next();
            return;
        }
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) {
            res.status(401).json({ ok: false, error: 'Token gerekli' });
            return;
        }
        const payload = verifyToken(token);
        if (!payload?.sub || !payload?.sid) {
            res.status(401).json({ ok: false, error: 'Geçersiz token' });
            return;
        }
        const [user, session] = await Promise.all([
            prisma.user.findUnique({
                where: { id: payload.sub },
                include: { roles: { include: { role: true } } }
            }),
            prisma.session.findUnique({ where: { id: payload.sid } })
        ]);
        if (!user || !session || session.revoked) {
            res.status(401).json({ ok: false, error: 'Yetkisiz' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            roles: user.roles.map((entry) => entry.role.name),
            claims: user.claimsJson ? JSON.parse(user.claimsJson) : undefined,
            mfaEnabled: user.mfaEnabled
        };
        req.session = session;
        req.token = token;
        next();
    }
    catch (error) {
        res.status(401).json({ ok: false, error: 'Yetkisiz' });
    }
}
