import type { Request, Response } from 'express';
import express from 'express';

import { assignRole } from './roleGuard.js';
import type { RoleName, User } from './types.js';
import {
  RepoUser,
  repoCountUsers,
  repoCreateUser,
  repoGetUser,
  repoListUsers,
  repoRemoveUserRole,
  repoSaveUser
} from './users.repo.js';
import { getTemplate, resolveEffectivePermissions } from './permissionTemplates.js';

export const usersRouter = express.Router();

function normaliseUser(user: RepoUser) {
  return {
    id: user.id,
    email: user.email ?? null,
    roles: user.roles ?? [],
    claims: user.claims ?? null,
    mfaEnabled: Boolean(user.mfaEnabled),
    sessions: user.sessions ?? [],
    sessionsCount: (user.sessions ?? []).length
  };
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

usersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const skip = parsePositiveInt(req.query.skip, 0);
    const requestedTake = parsePositiveInt(req.query.take, 50);
    const take = Math.min(Math.max(requestedTake, 1), 100);

    const [users, total] = await Promise.all([
      repoListUsers(q, skip, take),
      repoCountUsers(q)
    ]);

    const shaped = users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      roles: user.roles ?? [],
      mfaEnabled: Boolean(user.mfaEnabled),
      sessionsCount: (user.sessions ?? []).length
    }));

    res.json({ ok: true, users: shaped, paging: { skip, take, total } });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Listeleme hatası' });
  }
});

usersRouter.get('/:id/permissions', async (req: Request, res: Response) => {
  try {
    const user = await repoGetUser(req.params.id);
    if (!user) {
      res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
      return;
    }
    const allow = new Set<string>();
    for (const role of user.roles ?? []) {
      const template = getTemplate(role as RoleName);
      if (!template) continue;
      const resolved = resolveEffectivePermissions(template);
      for (const key of resolved.allow) {
        allow.add(key);
      }
    }
    res.json({ ok: true, allow: Array.from(allow).sort() });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'İzin çözümleme hatası' });
  }
});

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await repoGetUser(req.params.id);
    if (!user) {
      res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
      return;
    }
    res.json({ ok: true, user: normaliseUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Detay hatası' });
  }
});

usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const email = req.body?.email;
    if (email && typeof email !== 'string') {
      res.status(400).json({ ok: false, error: 'E-posta metin olmalıdır.' });
      return;
    }
    const created = await repoCreateUser(email?.trim() || undefined);
    res.status(201).json({ ok: true, user: normaliseUser(created) });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Oluşturma hatası' });
  }
});

usersRouter.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const user = await repoGetUser(req.params.id);
    if (!user) {
      res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
      return;
    }

    const role = req.body?.role;
    if (typeof role !== 'string') {
      res.status(400).json({ ok: false, error: 'Rol alanı zorunludur.' });
      return;
    }

    const claimsPayload = req.body?.claims;
    if (claimsPayload !== undefined && claimsPayload !== null && typeof claimsPayload !== 'object') {
      res.status(400).json({ ok: false, error: 'Claims nesne olmalıdır.' });
      return;
    }

    const guardUser: User = {
      id: user.id,
      roles: (user.roles ?? []) as RoleName[],
      claims: (user.claims ?? undefined) as User['claims'],
      mfaEnabled: user.mfaEnabled,
      sessions: user.sessions
    };

    if (claimsPayload !== undefined) {
      guardUser.claims = claimsPayload === null ? undefined : (claimsPayload as User['claims']);
    }

    const updated = assignRole(guardUser, role as RoleName);

    const toPersist: RepoUser = {
      ...user,
      roles: [...updated.roles],
      claims:
        claimsPayload === undefined
          ? user.claims
          : claimsPayload === null
          ? null
          : (claimsPayload as Record<string, unknown>),
      mfaEnabled: updated.mfaEnabled,
      sessions: updated.sessions
    };

    const saved = await repoSaveUser(toPersist);
    res.json({ ok: true, user: normaliseUser(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Rol atama hatası' });
  }
});

usersRouter.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const user = await repoGetUser(req.params.id);
    if (!user) {
      res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
      return;
    }

    const saved = await repoSaveUser({ ...user, sessions: [] });
    res.json({ ok: true, user: normaliseUser(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Oturum kapatma hatası' });
  }
});

usersRouter.delete('/:id/roles/:role', async (req: Request, res: Response) => {
  try {
    const { id, role } = req.params;
    const user = await repoGetUser(id);
    if (!user) {
      res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
      return;
    }

    const removed = await repoRemoveUserRole(id, role);
    if (!removed) {
      res.status(400).json({ ok: false, error: 'Rol kaldırılamadı.' });
      return;
    }

    const refreshed = await repoGetUser(id);
    if (!refreshed) {
      res.json({ ok: true, user: normaliseUser(user) });
      return;
    }
    res.json({ ok: true, user: normaliseUser(refreshed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    res.status(400).json({ ok: false, error: message ?? 'Rol kaldırma hatası' });
  }
});
