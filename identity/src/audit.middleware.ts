import { prisma } from './db.js';

function redact(payload: unknown, keys: string[] = ['password', 'token', 'secret']) {
  try {
    const clone = JSON.parse(JSON.stringify(payload ?? {}));
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      for (const key of Object.keys(node)) {
        if (keys.includes(key.toLowerCase())) {
          node[key] = '***';
        } else {
          visit(node[key]);
        }
      }
    };
    visit(clone);
    return clone;
  } catch {
    return undefined;
  }
}

export function attachAudit(app: any) {
  app.use((req: any, res: any, next: any) => {
    const shouldAudit = /^\/(api|approval|permissions|export)\b/.test(req.path);
    if (!shouldAudit) {
      next();
      return;
    }

    const started = Date.now();
    const params = req.params ?? {};
    const firstParamKey = Object.keys(params)[0];

    const entry: {
      actorId: string | null;
      actorEmail: string | null;
      tenantId?: string;
      action: string;
      method: string;
      path: string;
      targetType?: string;
      targetId?: string;
      status: number;
      ip?: string;
      userAgent?: string;
      metaJson?: string;
    } = {
      actorId: null,
      actorEmail: null,
      tenantId: (req.headers['x-tenant-id'] as string) || undefined,
      action: `${req.method} ${req.path}`,
      method: req.method,
      path: req.path,
      targetType: firstParamKey,
      targetId: firstParamKey ? String((params as any)[firstParamKey]) : undefined,
      status: 0,
      ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      metaJson: undefined
    };

    const meta = {
      query: redact(req.query),
      body: redact(req.body),
      params: redact(req.params),
      tookMs: undefined as number | undefined
    };

    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      try {
        const actor = req.user || {};
        entry.actorId = actor?.id ?? null;
        entry.actorEmail = actor?.email ?? null;
        entry.status = res.statusCode;
        meta.tookMs = Date.now() - started;
        entry.metaJson = JSON.stringify(meta);
        prisma.auditLog.create({ data: entry }).catch(() => {});
      } catch {
        // swallow logging errors
      }
      return originalEnd.apply(this, args as any);
    };

    next();
  });
}
