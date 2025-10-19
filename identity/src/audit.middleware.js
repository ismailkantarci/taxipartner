import { prisma } from './db.js';
function redact(payload, keys = ['password', 'token', 'secret']) {
    try {
        const clone = JSON.parse(JSON.stringify(payload ?? {}));
        const visit = (node) => {
            if (!node || typeof node !== 'object')
                return;
            for (const key of Object.keys(node)) {
                if (keys.includes(key.toLowerCase())) {
                    node[key] = '***';
                }
                else {
                    visit(node[key]);
                }
            }
        };
        visit(clone);
        return clone;
    }
    catch {
        return undefined;
    }
}
export function attachAudit(app) {
    app.use((req, res, next) => {
        const shouldAudit = /^\/(api|approval|permissions|export)\b/.test(req.path);
        if (!shouldAudit) {
            next();
            return;
        }
        const started = Date.now();
        const params = req.params ?? {};
        const firstParamKey = Object.keys(params)[0];
        const entry = {
            actorId: null,
            actorEmail: null,
            tenantId: req.headers['x-tenant-id'] || undefined,
            action: `${req.method} ${req.path}`,
            method: req.method,
            path: req.path,
            targetType: firstParamKey,
            targetId: firstParamKey ? String(params[firstParamKey]) : undefined,
            status: 0,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || undefined,
            userAgent: req.headers['user-agent'],
            metaJson: undefined
        };
        const meta = {
            query: redact(req.query),
            body: redact(req.body),
            params: redact(req.params),
            tookMs: undefined
        };
        const originalEnd = res.end;
        res.end = function (...args) {
            try {
                const actor = req.user || {};
                entry.actorId = actor?.id ?? null;
                entry.actorEmail = actor?.email ?? null;
                entry.status = res.statusCode;
                meta.tookMs = Date.now() - started;
                entry.metaJson = JSON.stringify(meta);
                prisma.auditLog.create({ data: entry }).catch(() => { });
            }
            catch {
                // swallow logging errors
            }
            return originalEnd.apply(this, args);
        };
        next();
    });
}
