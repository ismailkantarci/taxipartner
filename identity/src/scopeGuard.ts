import type { User } from './types.js';

type RequestWithUser = {
  user?: User & { claims?: any };
  body?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, unknown>;
};

type Response = {
  status(code: number): Response;
  json(payload: any): void;
};

type Next = () => void;

/**
 * scopeGuard requires request to specify tenantId and (optional) ouId in body/query.
 * Checks against user.claims.tenants / user.claims.ous
 */
export function scopeGuard() {
  return function scopeGuardMiddleware(req: RequestWithUser, res: Response, next: Next) {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: 'Yetkisiz: kullanıcı yok' });
      return;
    }

    const roles = Array.isArray((user as any).roles) ? (user as any).roles.map((r: string) => r.toLowerCase()) : [];
    const isSuperAdmin = roles.includes('superadmin'.toLowerCase()) || roles.includes('admin');

    const headerTenantRaw = req.headers?.['x-tenant-id'] ?? req.headers?.['X-Tenant-Id'];
    const headerTenant =
      Array.isArray(headerTenantRaw) && headerTenantRaw.length
        ? String(headerTenantRaw[0]).trim()
        : typeof headerTenantRaw === 'string'
        ? headerTenantRaw.trim()
        : undefined;

    if (!headerTenant) {
      res.status(400).json({ ok: false, error: 'x-tenant-id header zorunludur' });
      return;
    }

    const bodyTenant = typeof req.body?.tenantId === 'string' ? req.body.tenantId : undefined;
    const queryTenant = typeof req.query?.tenantId === 'string' ? req.query.tenantId : undefined;

    if (bodyTenant && bodyTenant !== headerTenant) {
      res.status(400).json({ ok: false, error: 'tenantId eşleşmiyor' });
      return;
    }
    if (queryTenant && queryTenant !== headerTenant) {
      res.status(400).json({ ok: false, error: 'tenantId eşleşmiyor' });
      return;
    }

    const tenantId = headerTenant;

    if (req.body) {
      req.body.tenantId = tenantId;
    }
    if (req.query) {
      (req.query as Record<string, unknown>).tenantId = tenantId;
    }
    (req as any).tenantId = tenantId;

    const allowedTenants: string[] = Array.isArray(user.claims?.tenants) ? user.claims.tenants : [];
    if (!isSuperAdmin && !allowedTenants.includes(tenantId)) {
      res.status(403).json({ ok: false, error: 'Bu tenant için erişim yetkiniz yok' });
      return;
    }

    const ouId = (req.body?.ouId ?? req.query?.ouId) as string | undefined;
    if (ouId) {
      const allowedOus: string[] = Array.isArray(user.claims?.ous) ? user.claims.ous : [];
      if (!isSuperAdmin && !allowedOus.includes(ouId)) {
        res.status(403).json({ ok: false, error: 'Bu OU için erişim yetkiniz yok' });
        return;
      }
    }

    next();
  };
}
