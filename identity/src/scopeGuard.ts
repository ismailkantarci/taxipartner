import type { User } from './types.js';

type RequestWithUser = {
  user?: User & { claims?: any };
  body?: Record<string, any>;
  query?: Record<string, any>;
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

    const tenantId = (req.body?.tenantId ?? req.query?.tenantId) as string | undefined;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: 'tenantId zorunludur' });
      return;
    }

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
