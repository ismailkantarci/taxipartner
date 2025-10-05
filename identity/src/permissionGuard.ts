import { getTemplate, resolveEffectivePermissions } from './permissionTemplates.js';
import { prisma } from './db.js';
import type { User } from './types.js';

function matchesWildcard(granted: string, required: string): boolean {
  if (granted === required) return true;
  if (granted.endsWith('.*')) {
    const prefix = granted.slice(0, -2);
    return required.startsWith(prefix);
  }
  return false;
}

/**
 * permissionGuard(required: string[])
 * Checks if req.user has all required permission keys.
 * Wildcards (*) supported in template allow.
 */
export function permissionGuard(required: string[]) {
  return async function permissionGuardMiddleware(req: any, res: any, next: any) {
    try {
      const user = (req as any).user as User | undefined;
      if (!user) {
        res.status(401).json({ ok: false, error: 'Yetkisiz: kullanıcı yok' });
        return;
      }

      const roles = await prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true }
      });

      const permissions = new Set<string>();
      for (const ur of roles) {
        const tpl = getTemplate(ur.role.name);
        if (!tpl) continue;
        const effective = resolveEffectivePermissions(tpl);
        for (const perm of effective.allow) {
          permissions.add(perm);
        }
      }

      const missing = required.filter((perm) => {
        if (permissions.has(perm)) return false;
        for (const granted of permissions) {
          if (matchesWildcard(granted, perm)) {
            return false;
          }
        }
        return true;
      });

      if (missing.length > 0) {
        res.status(403).json({ ok: false, error: `İzin eksik: ${missing.join(', ')}` });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
